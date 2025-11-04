import getMetadataQuery from './getMetadataQuery.js';
import saveLogsToFile from './saveLogsToFile.js';

async function runMetadataMatching(metadataMd1_collection, metadataMd3_collection, metadataName, refmodelMd1, refmodelMd3) {
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
        console.log(`Found ${resultsMd3Only.length} items that are only in md3.`);

        const logFilePath = './logs/metadata.log';
        const logHeader_Md1 = `Found ${resultsMd1Only.length} metadata that are only in md1 \n --- Only in md1 --- `;
        const logHeader_Md3 = `Found ${resultsMd3Only.length} metadata that are only in md3 \n --- Only in md3 --- `;

        const logMd1 = resultsMd1Only.map(item => item.identity).join('\n')

        const logMd3 = resultsMd3Only.map(item => item.identity).join('\n')

        const logString = logHeader_Md1 + '\n' + logMd1 + '\n' + logHeader_Md3 + '\n' + logMd3;

        saveLogsToFile(logString, logFilePath);

    }
    catch (err) {
        console.error("An error occured", err);
    }
}

export default runMetadataMatching;