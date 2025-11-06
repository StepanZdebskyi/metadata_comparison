import { MongoClient } from 'mongodb';
import 'dotenv/config'; // Load variables from .env file

import runFieldQueries from './utils/field_comparison/runFieldQueries.js';

const username = encodeURIComponent(process.env.DB_USERNAME);
const password = encodeURIComponent(process.env.DB_PASSWORD);
const cluster = process.env.DB_CLUSTER;

const uri = `mongodb+srv://${username}:${password}@${cluster}`;
const client = new MongoClient(uri);

//To search for a Standard Object, type "Standard Objects/<Object Name>" as an argument
//To search for a Custom Object, type "Custom Objects/<Object Name>" as an argument
const objectPath = process.argv[2].toString();

const refmodelMd1 = process.env.MD1_REFMODEL_ID.toString();
const refmodelMd3 = process.env.MD3_REFMODEL_ID.toString();

runFieldQueries(client, objectPath, refmodelMd1, refmodelMd3);