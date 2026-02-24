const { MongoClient } = require("mongodb");

let mongoClient = null;
let mongoDb = null;

const connectMongo = async () => {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME || "healthcare_nosql";

  if (!uri) {
    console.warn("MongoDB disabled: MONGO_URI not set");
    return null;
  }

  if (mongoDb) {
    return mongoDb;
  }

  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  mongoDb = mongoClient.db(dbName);

  console.log(`Connected to MongoDB database: ${dbName}`);
  return mongoDb;
};

const getMongoDb = () => {
  if (!mongoDb) {
    throw new Error("MongoDB not initialized");
  }
  return mongoDb;
};

const isMongoReady = () => !!mongoDb;

module.exports = {
  connectMongo,
  getMongoDb,
  isMongoReady,
};
