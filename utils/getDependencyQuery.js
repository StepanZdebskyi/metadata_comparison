import { ObjectId } from 'mongodb';

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

export default getDependencyQuery;