import getMetadataNodeByPathQuery from './getMetadataNodeByPathQuery.js'
import getMetadataNodeByIdQuery from './getMetadataNodeByIdQuery.js'
import saveLogsToFile from '../saveLogsToFile.js';
import { ObjectId } from "mongodb"

async function runFieldsComparison(metadataMd1_collection, metadataMd3_collection, fieldsFullPath, refmodelMd1, refmodelMd3) {

    const fieldIdsProjection = {
        nodes: 1,
        _id: 0 // Optional: Exclude the default _id field
    };

    const fieldsBodyProjection = {
        "nodeDetails": 1,
        "sf": 1,
        "summary": 1,
        _id: 0
    };

    try {
        const fieldIds_md1 = await metadataMd1_collection.find(getMetadataNodeByPathQuery(fieldsFullPath, refmodelMd1)).project(fieldIdsProjection).toArray();
        const fieldIds_md3 = await metadataMd3_collection.find(getMetadataNodeByPathQuery(fieldsFullPath, refmodelMd3)).project(fieldIdsProjection).toArray();

        const flattenedFieldIds_md1 = fieldIds_md1
            .flatMap(doc => doc.nodes)
            //If using the 'mongodb' driver:
            .map(id => new ObjectId(id.toString()));

        const flattenedFieldIds_md3 = fieldIds_md3
            .flatMap(doc => doc.nodes)
            .map(id => new ObjectId(id.toString()));

        const fields_md1 = metadataMd1_collection.find(getMetadataNodeByIdQuery(flattenedFieldIds_md1)).project(fieldsBodyProjection).toArray();
        const fields_md3 = metadataMd3_collection.find(getMetadataNodeByIdQuery(flattenedFieldIds_md3)).project(fieldsBodyProjection).toArray();

        const [fields_md1_result, fields_md3_result] = await Promise.all([fields_md1, fields_md3]);

        //fields comparison by sf.id and searching for the missing ones both in md1 and md3

        const md1_id_set = new Set(
            fields_md1_result.map(field => field.sf.id)
        );

        const md3_id_set = new Set(
            fields_md3_result.map(field => field.sf.id)
        );

        // Find items present in MD1 but MISSING in MD3
        const fields_onlyInMd1 = fields_md1_result.filter(field =>
            !md3_id_set.has(field.sf.id)
        );

        // Find items present in MD3 but MISSING in MD1
        const fields_onlyInMd3 = fields_md3_result.filter(field =>
            !md1_id_set.has(field.sf.id)
        );


        const md3_fields_map = new Map(
            fields_md3_result.map(field => [field.sf.id, field])
        );

        const matching_fields = fields_md1_result.filter(field_md1 =>
            md3_fields_map.has(field_md1.sf.id)
        ).map(field_md1 => ({
            // Return a structured object containing both versions
            md1: field_md1,
            md3: md3_fields_map.get(field_md1.sf.id)
        }));

        const discrepancies = [];
        let discrepanciesCount = 0;
        const keysToCompare = ['sf', 'nodeDetails', 'summary']; // Top-level properties to deep-compare

        for (const pair of matching_fields) {
            const diff = {
                sfId: pair.md1.sf.id,
                name: pair.md1.sf.apiName, // Assuming the name is the same
                differences: {}
            };
            let foundDifference = false;

            // Iterate over the main sections of the field object
            for (const key of keysToCompare) {
                const md1Obj = pair.md1[key];
                const md3Obj = pair.md3[key];

                if (!md1Obj || !md3Obj) {
                    // Handle cases where a top-level property (like 'sf' or 'nodeDetails') is missing in one version
                    if (JSON.stringify(md1Obj) !== JSON.stringify(md3Obj)) {
                        diff.differences[key] = {
                            path: key,
                            md1: md1Obj ? 'Present' : 'Missing',
                            md3: md3Obj ? 'Present' : 'Missing',
                            value_md1: md1Obj,
                            value_md3: md3Obj
                        };
                        foundDifference = true;
                    }
                    continue;
                }

                if (key === 'summary' && (md1Obj.toString() !== md3Obj.toString())) {
                    diff.differences[key] = {
                        path: key,
                        value_md1: md1Obj,
                        value_md3: md3Obj
                    };
                    foundDifference = true;
                }

                if (key !== 'summary') {
                    // Compare individual properties within the section (e.g., within 'sf' or 'nodeDetails')
                    const allKeys = new Set([
                        ...Object.keys(md1Obj),
                        ...Object.keys(md3Obj)
                    ]);

                    for (const propKey of allKeys) {
                        // We want to skip comparing internal MongoDB fields like '_id'
                        if (propKey === '_id') continue;

                        const md1Value = md1Obj[propKey];
                        const md3Value = md3Obj[propKey];

                        // NOTE: Simple comparison (===) works for primitive types (string, number, boolean)
                        // but complex objects/arrays need deep comparison. We'll use JSON.stringify for a safe
                        // comparison of potentially complex objects/dates for this utility script.

                        if (JSON.stringify(md1Value) !== JSON.stringify(md3Value)) {
                            const fullPath = `${key}.${propKey}`;

                            // Store the difference
                            diff.differences[fullPath] = {
                                path: fullPath,
                                value_md1: md1Value,
                                value_md3: md3Value
                            };
                            foundDifference = true;
                        }
                    }
                }
            }

            if (foundDifference) {
                discrepancies.push(diff);
                discrepanciesCount++;
            }
        }

        const stringDiscrepancies = [];

        for (const item of discrepancies) {
            const fieldId = item.sfId;
            const fieldName = item.name;

            // Iterate through each specific difference for this field
            for (const diffPath in item.differences) {
                if (item.differences.hasOwnProperty(diffPath)) {
                    const difference = item.differences[diffPath];

                    // Format values for output (handling complex types by stringifying)
                    const valueMD1 = JSON.stringify(difference.value_md1);
                    const valueMD3 = JSON.stringify(difference.value_md3);

                    const outputString = `Field: ${fieldName} (${fieldId}) | Path: ${diffPath} | MD1: ${valueMD1} | MD3: ${valueMD3}`;
                    stringDiscrepancies.push(outputString);
                }
            }
        }

        console.log("\n--- Results for Field Queries (status: 'active') ---");
        console.log(`Found ${fields_md1_result.length} fields from md1 env for the object`);
        console.log(`Found ${fields_md3_result.length} fields from md3 env for the object`);

        console.log("--- Field Count Comparison ---");
        console.log(`Total Matches: ${matching_fields.length}`);

        console.log(`Found ${fields_onlyInMd1.length} items that are only in md1.`);
        console.log(`Found ${fields_onlyInMd3.length} items that are only in md3.`);

        console.log(`Fields with discrepancies: ${discrepanciesCount}`);
        //report building

        let fieldsReport = "--- Field Comparison ---\n" + `Found ${fields_onlyInMd1.length} items that are only in md1.\n`;

        const fieldsLog_md1Only = fields_onlyInMd1.map(item => item.sf.id).join('\n');
        const fieldsLog_md3Only = fields_onlyInMd3.map(item => item.sf.id).join('\n');

        const discrepancies_log = stringDiscrepancies.join('\n');

        fieldsReport += fieldsLog_md1Only + `Found ${fields_onlyInMd3.length} items that are only in md3.\n` + fieldsLog_md3Only + "\n" +
            "--- Field Discrepancies ---\n" + `Fields with discrepancies: ${discrepanciesCount}\n` + "---------------------------\n" + discrepancies_log;

        const logFilePath = './logs/fields_comparison.log';
        saveLogsToFile(fieldsReport, logFilePath);

    } catch (error) {
        console.error("Error executing query:", error);
    }
}

export default runFieldsComparison;