import r from "rethinkdb";
let instance;
const connection = async () => {
  if (!instance) {
    return r.connect(
      {
        host: "localhost",
        port: 28015,
        user: "admin",
        password: "moya",
      },
      function (err, connection) {
        if (err) {
          throw err;
        }
        return connection;
      }
    );
  }
  return instance;
};

export default connection;
