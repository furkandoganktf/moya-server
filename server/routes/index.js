import express from "express";
import dotenv from "dotenv";
import wifi from "node-wifi";
import r from "rethinkdb";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import checkAuth from "../middleware/checkAuth";
import { print } from "../helpers/printErrors";
var router = express.Router();

dotenv.config();
const secret_key = process.env.SECRET_KEY;

const db = r.db("Moya");

router.post("/users/authenticate", async (req, res) => {
  try {
    const username = req.body.username;
    let password = req.body.password;
    if (!username || !password) {
      res.status(400).send({ message: "Username or Password can not be empty" });
    } else {
      password = crypto.createHash("md5").update(req.body.password).digest("hex");
      await db
        .table("users")
        .filter({ email: username, password: password })
        .run(req.app._rdbConn, (err, cursor) => {
          if (err) throw err;
          cursor.toArray(async (err, user) => {
            if (err) throw err;
            if (user.length !== 0) {
              const token = jwt.sign(
                {
                  uuid: user[0].id,
                  email: user[0].email,
                },
                secret_key,
                { expiresIn: "7d" }
              );
              res.status(200).send({ user: user[0], token: token });
            } else {
              res.status(400).send({ message: "User not found. Authentication failed." });
            }
          });
        });
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Authentication failed." });
  }
});

app.post("/users/register", function (req, res) {
  try {
    let name = req.body.name;
    let surname = req.body.surname;
    let username = req.body.username;
    let password = req.body.password;
    if (!username || !password) {
      res.status(400).send({
        message: "Username or Password can not be empty.",
      });
    } else {
      db.table("users")
        .filter(r.row("email").eq(username))
        .count()
        .eq(1)
        .run(conn, function (err, result) {
          if (err) throw err;
          if (result) {
            res.status(400).send({ message: "This email is already in use." });
          } else {
            password = crypto.createHash("md5").update(req.body.password).digest("hex");
            db.table("users")
              .insert({
                name: name,
                surname: surname,
                email: username,
                password: password,
              })
              .run(conn, function (err) {
                if (err) console.log(err);
                res.status(200).send({ message: "User created succesfully." });
              });
          }
        });
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Registration failed." });
  }
});

export default router;
