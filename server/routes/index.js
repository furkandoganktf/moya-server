import express from "express";
import dotenv from "dotenv";
import r from "rethinkdb";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import checkAuth from "../middleware/checkAuth";
import { print } from "../helpers/printErrors";
var router = express.Router();

dotenv.config();
const secret_key = process.env.SECRET_KEY;

const db = r.db("moya");

router.post("/users/authenticate", async (req, res) => {
  try {
    const username = req.body.username;
    let password = req.body.password;
    if (!username || !password) {
      res.status(400).send({ message: "Kullanıcı adı veya şifre boş olamaz!" });
    } else {
      password = crypto.createHash("md5").update(req.body.password).digest("hex");
      let cursor = await db.table("users").filter({ email: username, password: password }).run(req.app._rdbConn);
      let user = await cursor.toArray();
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
        res.status(400).send({ message: "Kullanıcı bulunamadı." });
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Giriş başarısız." });
  }
});

router.post("/users/register", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    let name = req.body.name;
    let surname = req.body.surname;
    let username = req.body.email;
    let password = req.body.password;
    if (!username || !password) {
      res.status(400).send({
        message: "Kullanıcı adı veya şifre boş olamaz!.",
      });
    } else {
      let result = await db.table("users").filter(r.row("email").eq(username)).count().eq(1).run(req.app._rdbConn);
      if (result) {
        res.status(400).send({ message: "Bu email zaten kullanımda." });
      } else {
        password = crypto.createHash("md5").update(req.body.password).digest("hex");
        await db
          .table("users")
          .insert({
            name: name,
            surname: surname,
            email: username,
            password: password,
          })
          .run(req.app._rdbConn);
        res.status(200).send({ message: "Kullanıcı başarıyla oluşturuldu." });
        let timeStamp = Date.now();
        await db
          .table("logs")
          .insert({ email: user, log: username + " kullancısı eklendi!", timeStamp: timeStamp })
          .run(req.app._rdbConn);
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/users", checkAuth, async (req, res) => {
  try {
    let cursor = await db.table("users").run(req.app._rdbConn);
    let users = await cursor.toArray();
    res.status(200).send({ users: users });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kullancılar getirilemedi." });
  }
});

router.put("/users/:userId", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    var userId = req.params.userId;
    const username = req.body.email;
    let password = req.body.password;
    if (!username || !password) {
      res.status(400).send({ message: "Kullanıcı adı veya şifre boş olamaz!" });
    } else {
      let cursor = await db.table("users").get(userId).run(req.app._rdbConn);
      if (cursor.email !== username) {
        let result = await db.table("users").filter(r.row("email").eq(username)).count().eq(1).run(req.app._rdbConn);
        if (result) {
          res.status(400).send({ message: "Bu email zaten kullanımda." });
        } else {
          password = crypto.createHash("md5").update(req.body.password).digest("hex");
          let cursor = await db
            .table("users")
            .get(userId)
            .update({ ...req.body, password: password })
            .run(req.app._rdbConn);
          res.status(200).send({ message: "Kullanıcı güncellendi" });
          let timeStamp = Date.now();
          await db
            .table("logs")
            .insert({ email: user, log: cursor.email + " kullancısı güncellendi!", timeStamp: timeStamp })
            .run(req.app._rdbConn);
        }
      } else {
        password = crypto.createHash("md5").update(req.body.password).digest("hex");
        await db
          .table("users")
          .get(userId)
          .update({ ...req.body, password: password })
          .run(req.app._rdbConn);
        res.status(200).send({ message: "Kullanıcı güncellendi" });
        let timeStamp = Date.now();
        await db
          .table("logs")
          .insert({ email: user, log: username + " kullancısı güncellendi!", timeStamp: timeStamp })
          .run(req.app._rdbConn);
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kullanıcı güncelleme başarısız." });
  }
});

router.delete("/users/:userId", checkAuth, async (req, res) => {
  try {
    var userId = req.params.userId;
    let user = req.userData.email;
    let cursor = await db.table("users").get(userId).delete({ returnChanges: true }).run(req.app._rdbConn);
    res.status(200).send({ message: "Kullanıcı silindi" });
    let timeStamp = Date.now();
    await db
      .table("logs")
      .insert({ email: user, log: cursor.changes[0]["old_val"].email + " kullanıcısı silindi!", timeStamp: timeStamp })
      .run(req.app._rdbConn);
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kullanıcı silme başarısız." });
  }
});

router.get("/logs", checkAuth, async (req, res) => {
  try {
    let cursor = await db.table("logs").run(req.app._rdbConn);
    let logs = await cursor.toArray();
    res.status(200).send({ logs: logs });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Loglar getirilemedi." });
  }
});

export default router;
