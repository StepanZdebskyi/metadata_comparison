import runMetadataMatching from './runMetadataMatching.js'; 
import runDependencyMatchingByIdentity from './runDependencyMatchingByIdentity.js';

async function runQueries(client, metadataName, refmodelMd1, refmodelMd3) {
  try {
    // Connect to the database
    await client.connect();

    const md1_db = client.db(process.env.DB_NAME_MD1);
    const metadataMd1_collection = md1_db.collection("ReferenceModelNode");
    const dependenciesMd1Collection = md1_db.collection("ReferenceModelNodeDependencies");

    const md3_db = client.db(process.env.DB_NAME_MD3)
    const metadataMd3_collection = md3_db.collection("ReferenceModelNode");
    const dependenciesMd3Collection = md3_db.collection("ReferenceModelNodeDependencies");

    await runMetadataMatching(metadataMd1_collection, metadataMd3_collection, metadataName, refmodelMd1, refmodelMd3);
    await runDependencyMatchingByIdentity(dependenciesMd1Collection, dependenciesMd3Collection, 
        metadataMd1_collection, metadataMd3_collection, metadataName, refmodelMd1, refmodelMd3);

  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    await client.close();
  }
}

export default runQueries;