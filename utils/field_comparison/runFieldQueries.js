import runFieldsComparison from './runFieldsComparison.js'

async function runFieldQueries(client, objectPath, refmodelMd1, refmodelMd3) {
    try {
        // Connect to the database
        await client.connect();

        const md1_db = client.db(process.env.DB_NAME_MD1);
        const metadataMd1_collection = md1_db.collection("ReferenceModelNode");

        const md3_db = client.db(process.env.DB_NAME_MD3)
        const metadataMd3_collection = md3_db.collection("ReferenceModelNode");

        const fieldsFullPath = "Objects/" + objectPath + "/Fields"; 

        await runFieldsComparison(metadataMd1_collection, metadataMd3_collection, fieldsFullPath, refmodelMd1, refmodelMd3);

    } catch (err) {
        console.error("An error occurred:", err);
    } finally {
        await client.close();
    }
}

export default runFieldQueries; 