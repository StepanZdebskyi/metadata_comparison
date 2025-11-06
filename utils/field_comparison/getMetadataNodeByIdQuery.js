import { ObjectId } from 'mongodb';

function getMetadataNodeByIdQuery(allNodeIds) {
    return {
        "_id":  { $in: allNodeIds }
    };
}

export default getMetadataNodeByIdQuery; 