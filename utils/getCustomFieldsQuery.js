import { ObjectId } from 'mongodb';

function getCustomObjectFieldsQuery(refmodelId) {
  return {
    "$and": [
      { "refModel": new ObjectId(refmodelId) },
      { "sf.type": "Field" },
      { "identity": { "$regex": "__c\\." } }
    ]
  };
}

export default getCustomObjectFieldsQuery; 