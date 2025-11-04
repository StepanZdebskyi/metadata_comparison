import getDependencyQuery from './getDependencyQuery.js';
import saveLogsToFile from './saveLogsToFile.js';

async function runDependencyMatchingByIdentity(dependenciesMd1Collection, dependenciesMd3Collection, metadataMd1_collection, metadataMd3_collection,
    metadataName, refmodelMd1, refmodelMd3) {

    try {
        const dependencyProjection = {
            projection: {
                childId: 1,
                parentId: 1,
                _id: 0          // 0 means "exclude this field"
            }
        }

        const identityProjection = { projection: { _id: 1, identity: 1 } };

        const dependcyPromiseMd1 = dependenciesMd1Collection.find(getDependencyQuery(metadataName, refmodelMd1), dependencyProjection).toArray();
        const dependcyPromiseMd3 = dependenciesMd3Collection.find(getDependencyQuery(metadataName, refmodelMd3), dependencyProjection).toArray();
        const [dependencyMd1_result, dependencyMd3_result] = await Promise.all([dependcyPromiseMd1, dependcyPromiseMd3]);

        const childIdSet_Md1 = new Set(
            dependencyMd1_result
                .map(dep => dep.childId) // Беремо всі childId
                .filter(Boolean) // Видаляємо null або undefined, якщо такі є
        );

        const parentIdSet_Md1 = new Set(
            dependencyMd1_result
                .map(dep => dep.parentId) // Беремо всі parentId
                .filter(Boolean)
        );

        const combinedSet_Md1 = new Set([...childIdSet_Md1, ...parentIdSet_Md1]);

        const childIdSet_Md3 = new Set(
            dependencyMd3_result
                .map(dep => dep.childId) // Беремо всі childId
                .filter(Boolean) // Видаляємо null або undefined, якщо такі є
        );

        const parentIdSet_Md3 = new Set(
            dependencyMd3_result
                .map(dep => dep.parentId) // Беремо всі parentId
                .filter(Boolean)
        );

        const combinedSet_Md3 = new Set([...childIdSet_Md3, ...parentIdSet_Md3]);

        const nodePromise_md1 = metadataMd1_collection.find(
            { _id: { $in: [...combinedSet_Md1] } }, // $in приймає масив
            identityProjection
        ).toArray();

        const nodePromise_md3 = metadataMd3_collection.find(
            { _id: { $in: [...combinedSet_Md3] } }, // $in приймає масив
            identityProjection
        ).toArray();

        const [combinedNodeIdentities_Md1, combinedNodeIdentities_Md3] = await Promise.all([nodePromise_md1, nodePromise_md3]);

        const combinedNodeIdentitiesMap_Md1 = new Map(
            combinedNodeIdentities_Md1.map(node => [node._id.toString(), node.identity])
        );

        const combinedNodeIdentitiesMap_Md3 = new Map(
            combinedNodeIdentities_Md3.map(node => [node._id.toString(), node.identity])
        );

        const finalMd1Result = dependencyMd1_result.map(dep => {
            // Конвертуємо ID в рядок для пошуку в Map
            const childIdStr = dep.childId?.toString();
            const parentIdStr = dep.parentId?.toString();

            return {
                child_identity: combinedNodeIdentitiesMap_Md1.get(childIdStr) ?? null,
                parent_identity: combinedNodeIdentitiesMap_Md1.get(parentIdStr) ?? null
            };
        });

        const finalMd3Result = dependencyMd3_result.map(dep => {
            // Конвертуємо ID в рядок для пошуку в Map
            const childIdStr = dep.childId?.toString();
            const parentIdStr = dep.parentId?.toString();

            return {
                child_identity: combinedNodeIdentitiesMap_Md3.get(childIdStr) ?? null,
                parent_identity: combinedNodeIdentitiesMap_Md3.get(parentIdStr) ?? null
            };
        });

        console.log("\n--- Results for Dependency Queries BY IDENTITY (status: 'active') ---");
        console.log(`Found ${finalMd1Result.length} dependencies from md1 env.`);
        console.log(`Found ${finalMd3Result.length} dependencies from md3 env.`);

        //dependencies matching 
        const dependencyKeysMd1 = new Set(finalMd1Result.map(item => {
            const child = item?.child_identity ?? 'null';
            const parent = item?.parent_identity ?? 'null';
            return `${child}::${parent}`; // "path/A::path/B"
        }));

        const dependencyKeysMd3 = new Set(finalMd3Result.map(item => {
            const child = item?.child_identity ?? 'null';
            const parent = item?.parent_identity ?? 'null';
            return `${child}::${parent}`; // "path/A::path/B"
        }));

        const matchingDocs_Dependency = finalMd1Result.filter(item2 => {
            // Створіть такий самий унікальний ключ для поточного елемента
            const key = `${item2?.child_identity ?? 'null'}::${item2?.parent_identity ?? 'null'}`;

            // Перевірте, чи цей ключ існує в нашому Set з першого результату
            return dependencyKeysMd3.has(key);
        });

        // 4. Знаходимо унікальні для MD1 (ті, що є в md1, АЛЕ НЕМАЄ в md3)
        const dependencyMd1_Only = finalMd1Result.filter(item1 => {
            const key = `${item1?.child_identity ?? 'null'}::${item1?.parent_identity ?? 'null'}`;
            return !dependencyKeysMd3.has(key);
        });

        // 5. Знаходимо унікальні для MD3 (ті, що є в md3, АЛЕ НЕМАЄ в md1)
        const dependencyMd3_Only = finalMd3Result.filter(item3 => {
            const key = `${item3?.child_identity ?? 'null'}::${item3?.parent_identity ?? 'null'}`;
            return !dependencyKeysMd1.has(key);
        });

        const logFilePath = './logs/dependencies.log';
        const logHeader_Md1 = `Found ${dependencyMd1_Only.length} dependencies that are only in md1`;
        const logHeader_Md3 = `Found ${dependencyMd3_Only.length} dependencies that are only in md3`;

        console.log("--- Dependencies Comparison Complete BY IDENTITY ---");
        console.log(`Total Matches: ${matchingDocs_Dependency.length}`);
        console.log(logHeader_Md1);
        console.log(logHeader_Md3);

        const logMd1 = Object.entries(dependencyMd1_Only)
            .map(([key, value]) => {
                return `${value.child_identity} --> ${value.parent_identity}`;
            })
            .join('\n');

        const logMd3 = Object.entries(dependencyMd3_Only)
             .map(([key, value]) => {
                return `${value.child_identity} --> ${value.parent_identity}`;
            })
            .join('\n');

        const logString = logHeader_Md1 + '\n --- Only in md1 ---' + '\n' + logMd1 + '\n' + logHeader_Md3 + '\n --- Only in md3 ---' + '\n' + logMd3;

        saveLogsToFile(logString, logFilePath);
    }
    catch (err) {
        console.error("An error occured", err);
    }
}

export default runDependencyMatchingByIdentity;