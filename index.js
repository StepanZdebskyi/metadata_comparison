import { MongoClient } from 'mongodb';
import 'dotenv/config'; // Load variables from .env file

import runQueries from './utils/runQueries.js';

// 1. Get credentials from environment variables
const username = encodeURIComponent(process.env.DB_USERNAME);
const password = encodeURIComponent(process.env.DB_PASSWORD);
const cluster = process.env.DB_CLUSTER;

const uri = `mongodb+srv://${username}:${password}@${cluster}`;
const client = new MongoClient(uri);

const metadataName = process.argv[2].toString();

const refmodelMd1 = process.env.MD1_REFMODEL_ID.toString();
const refmodelMd3 = process.env.MD3_REFMODEL_ID.toString();

runQueries(client, metadataName, refmodelMd1, refmodelMd3);