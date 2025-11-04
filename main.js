import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'; // Load variables from .env file

// 1. Get credentials from environment variables
const username = encodeURIComponent(process.env.DB_USERNAME);
const password = encodeURIComponent(process.env.DB_PASSWORD);
const cluster = process.env.DB_CLUSTER;
const dbName = process.env.DB_NAME_MD1;

const uri = `mongodb+srv://${username}:${password}@${cluster}/${dbName}`;
const client = new MongoClient(uri);

const metadataName = process.argv[2].toString();

const refmodelMd1 = "690342d5e000d75e76add29e";
const refmodelMd3 = "6903435ecb96a5845bb72da8";

function getMetadataQuery(metadataName, refmodelId) {
  return {
    "$and": [
      { "refModel": new ObjectId(refmodelId) },
      { "sf.type": metadataName }]
  };
}

function getDependencyQuery(metadataName, refmodelId) {
  return {
    "$and": [
      { "refModelId": new ObjectId(refmodelId) },
      {
        "$or": [
          { "childSfType": metadataName },
          { "parentSfType": metadataName },
        ]
      }]
  };
}

async function runQueries() {
  try {
    // Connect to the database
    await client.connect();

    const md1_db = client.db(process.env.DB_NAME_MD1);
    const metadataMd1_collection = md1_db.collection("ReferenceModelNode");
    const dependenciesMd1Collection = md1_db.collection("ReferenceModelNodeDependencies");

    const md3_db = client.db(process.env.DB_NAME_MD3)
    const metadataMd3_collection = md3_db.collection("ReferenceModelNode");
    const dependenciesMd3Collection = md3_db.collection("ReferenceModelNodeDependencies");

    await runMetadataMatching(metadataMd1_collection, metadataMd3_collection);
    //await runDependencyMatching(dependenciesMd1Collection, dependenciesMd3Collection);
    await runDependencyMatchingByIdentity(dependenciesMd1Collection, dependenciesMd3Collection, metadataMd1_collection, metadataMd3_collection);

  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    await client.close();
  }
}

async function runMetadataMatching(metadataMd1_collection, metadataMd3_collection) {
  try {
    const metadataProjection = {
      projection: {
        identity: 1,  // 1 means "include this field"
        _id: 0          // 0 means "exclude this field"
      }
    }

    const metadataPromiseMd1 = metadataMd1_collection.find(getMetadataQuery(metadataName, refmodelMd1), metadataProjection).toArray();
    const metadataPromiseMd3 = metadataMd3_collection.find(getMetadataQuery(metadataName, refmodelMd3), metadataProjection).toArray();

    const [metadataMd1_result, metadataMd3_result] = await Promise.all([metadataPromiseMd1, metadataPromiseMd3]);

    console.log("\n--- Results for Metadata Queries (status: 'active') ---");
    console.log(`Found ${metadataMd1_result.length} metadata items from md1 env.`);
    console.log(`Found ${metadataMd3_result.length} metadata items from md3 env.`);

    //metadata matching 
    const identitiesFromMd1 = new Set(metadataMd1_result.map(item => item.identity));
    const matchingDocs_Metadata = metadataMd3_result.filter(item2 =>
      identitiesFromMd1.has(item2.identity)
    );

    const totalMatches_Metadata = matchingDocs_Metadata.length;

    console.log("--- Metadata Comparison Complete ---");
    console.log(`Total Matches: ${totalMatches_Metadata}`);

    const identitiesFromMd3 = new Set(metadataMd3_result.map(item => item.identity));

    const resultsMd1Only = metadataMd1_result.filter(item1 =>
      !identitiesFromMd3.has(item1.identity)
    );

    const resultsMd3Only = metadataMd3_result.filter(item1 => !identitiesFromMd1.has(item1.identity));

    console.log(`Found ${resultsMd1Only.length} items that are only in md1.`);

    if (resultsMd1Only.length > 0 && resultsMd1Only.length < 100) {
      console.log("--- Only in md1 ---");
      console.log(resultsMd1Only.map(item => item.identity).join('\n'));
    }

    console.log(`Found ${resultsMd3Only.length} items that are only in md3.`);

    if (resultsMd3Only.length > 0 && resultsMd3Only.length < 100) {
      console.log("--- Only in md3 ---");
      console.log(resultsMd3Only.map(item => item.identity).join('\n'));
    }
  }
  catch (err) {
    console.error("An error occured", err);
  }
}

async function runDependencyMatching(dependenciesMd1Collection, dependenciesMd3Collection) {
  try {
    const dependencyProjection = {
      projection: {
        child: {
          path: 1,
        },
        parent: {
          path: 1
        },
        _id: 0          // 0 means "exclude this field"
      }
    }

    const dependcyPromiseMd1 = dependenciesMd1Collection.find(getDependencyQuery(metadataName, refmodelMd1), dependencyProjection).toArray();
    const dependcyPromiseMd3 = dependenciesMd3Collection.find(getDependencyQuery(metadataName, refmodelMd3), dependencyProjection).toArray();
    const [dependencyMd1_result, dependencyMd3_result] = await Promise.all([dependcyPromiseMd1, dependcyPromiseMd3]);

    console.log("\n--- Results for Dependency Queries (status: 'active') ---");
    console.log(`Found ${dependencyMd1_result.length} dependencies from md1 env.`);
    console.log(`Found ${dependencyMd3_result.length} dependencies from md3 env.`);

    //dependencies matching 
    const dependencyKeysMd1 = new Set(dependencyMd1_result.map(item => {
      const child = item.child?.path ?? 'null';
      const parent = item.parent?.path ?? 'null';
      return `${child}::${parent}`; // "path/A::path/B"
    }));

    const dependencyKeysMd3 = new Set(dependencyMd3_result.map(item => {
      const child = item.child?.path ?? 'null';
      const parent = item.parent?.path ?? 'null';
      return `${child}::${parent}`; // "path/A::path/B"
    }));

    const matchingDocs_Dependency = dependencyMd1_result.filter(item2 => {
      // Створіть такий самий унікальний ключ для поточного елемента
      const key = `${item2.child?.path ?? 'null'}::${item2.parent?.path ?? 'null'}`;

      // Перевірте, чи цей ключ існує в нашому Set з першого результату
      return dependencyKeysMd3.has(key);
    });

    // 4. Знаходимо унікальні для MD1 (ті, що є в md1, АЛЕ НЕМАЄ в md3)
    const dependencyMd1_Only = dependencyMd1_result.filter(item1 => {
      const key = `${item1.child?.path ?? 'null'}::${item1.parent?.path ?? 'null'}`;
      return !dependencyKeysMd3.has(key);
    });

    // 5. Знаходимо унікальні для MD3 (ті, що є в md3, АЛЕ НЕМАЄ в md1)
    const dependencyMd3_Only = dependencyMd3_result.filter(item3 => {
      const key = `${item3.child?.path ?? 'null'}::${item3.parent?.path ?? 'null'}`;
      return !dependencyKeysMd1.has(key);
    });

    console.log("--- Dependencies Comparison Complete ---");
    console.log(`Total Matches: ${matchingDocs_Dependency.length}`);
    console.log(`Found ${dependencyMd1_Only.length} dependencies that are only in md1`);
    console.log(`Found ${dependencyMd3_Only.length} dependencies that are only in md3`);
  }
  catch (err) {
    console.error("An error occured", err);
  }
}

async function runDependencyMatchingByIdentity(dependenciesMd1Collection, dependenciesMd3Collection, metadataMd1_collection, metadataMd3_collection) {
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

    console.log("--- Dependencies Comparison Complete BY IDENTITY ---");
    console.log(`Total Matches: ${matchingDocs_Dependency.length}`);
    console.log(`Found ${dependencyMd1_Only.length} dependencies that are only in md1`);
    console.log(`Found ${dependencyMd3_Only.length} dependencies that are only in md3`);
  }
  catch (err) {
    console.error("An error occured", err);
  }
}

runQueries();