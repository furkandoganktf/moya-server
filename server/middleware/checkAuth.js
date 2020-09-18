import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const secret_key = process.env.SECRET_KEY;

const checkAuth = (req, res, next) => {
  try {
    /*JWT is send with request header! 
        Format of it: Authorization : Bearer <token>
        */
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, secret_key);
    req.userData = decodedToken;
    next();
  } catch (error) {
    return res.status(401).send({
      message: "Auth failed",
    });
  }
};

export default checkAuth;
