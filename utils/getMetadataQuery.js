import { ObjectId } from 'mongodb';

function getMetadataQuery(metadataName, refmodelId) {
  return {
    "$and": [
      { "refModel": new ObjectId(refmodelId) },
      { "sf.type": metadataName }]
  };
}

export default getMetadataQuery; 