const { ObjectId } = require("mongodb");
const { getMongoDb, isMongoReady } = require("../config/mongo");
const { emitToUser } = require("../socket/socketServer");

const COLLECTION = "notifications";

const ensureMongo = () => {
  if (!isMongoReady()) {
    throw new Error("MongoDB is not connected");
  }
};

const getCollection = () => getMongoDb().collection(COLLECTION);

const createNotification = async ({
  userId,
  type,
  title,
  message,
  metadata = {},
}) => {
  ensureMongo();
  const doc = {
    user_id: Number(userId),
    type,
    title,
    message,
    metadata,
    read: false,
    created_at: new Date(),
  };

  const result = await getCollection().insertOne(doc);
  const payload = { ...doc, _id: result.insertedId.toString() };
  emitToUser(userId, "notification:new", payload);
  return payload;
};

const createNotificationsForUsers = async (userIds, payload) => {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean).map(Number))];
  for (const userId of uniqueIds) {
    await createNotification({ userId, ...payload });
  }
};

const listNotifications = async ({ userId, limit = 20, offset = 0, read }) => {
  ensureMongo();
  const query = { user_id: Number(userId) };

  if (read === true || read === false) {
    query.read = read;
  }

  const docs = await getCollection()
    .find(query)
    .sort({ created_at: -1 })
    .skip(offset)
    .limit(limit)
    .toArray();

  return docs.map((doc) => ({ ...doc, _id: doc._id.toString() }));
};

const getUnreadCount = async (userId) => {
  ensureMongo();
  return getCollection().countDocuments({
    user_id: Number(userId),
    read: false,
  });
};

const markNotificationRead = async ({ userId, notificationId }) => {
  ensureMongo();
  let objectId;
  try {
    objectId = new ObjectId(notificationId);
  } catch {
    return false;
  }

  const result = await getCollection().updateOne(
    { _id: objectId, user_id: Number(userId) },
    { $set: { read: true, read_at: new Date() } }
  );

  return result.matchedCount > 0;
};

const markAllNotificationsRead = async (userId) => {
  ensureMongo();
  const result = await getCollection().updateMany(
    { user_id: Number(userId), read: false },
    { $set: { read: true, read_at: new Date() } }
  );
  return result.modifiedCount;
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
};
