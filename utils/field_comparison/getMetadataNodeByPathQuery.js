import { ObjectId } from 'mongodb';

function getMetadataNodeByPathQuery(fieldsFullPath, refmodelId) {
    return {
        "$and": [
            { "refModel": new ObjectId(refmodelId) },
            { "sf.fullPath":  fieldsFullPath}
        ]
    };
}

export default getMetadataNodeByPathQuery; 