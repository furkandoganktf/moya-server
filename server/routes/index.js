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
              res.status(400).send({ message: "Kullanıcı bulunamadı." });
            }
          });
        });
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
      await db
        .table("users")
        .filter(r.row("email").eq(username))
        .count()
        .eq(1)
        .run(req.app._rdbConn, async (err, result) => {
          if (err) throw err;
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
              .run(req.app._rdbConn, async (err) => {
                if (err) throw err;
                res.status(200).send({ message: "Kullanıcı başarıyla oluşturuldu." });
                await db
                  .table("logs")
                  .insert({ email: user, log: username + " kullancısı eklendi!" })
                  .run(req.app._rdbConn);
              });
          }
        });
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/users", checkAuth, async (req, res) => {
  try {
    await db.table("users").run(req.app._rdbConn, async (err, cursor) => {
      if (err) throw err;
      cursor.toArray(async (err, users) => {
        if (err) throw err;
        res.status(200).send({ users: users });
      });
    });
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
      await db
        .table("users")
        .get(userId)
        .run(req.app._rdbConn, async (err, cursor) => {
          if (err) throw err;
          if (cursor.email !== username) {
            await db
              .table("users")
              .filter(r.row("email").eq(username))
              .count()
              .eq(1)
              .run(req.app._rdbConn, async (err, result) => {
                if (err) throw err;
                if (result) {
                  res.status(400).send({ message: "Bu email zaten kullanımda." });
                } else {
                  password = crypto.createHash("md5").update(req.body.password).digest("hex");
                  await db
                    .table("users")
                    .get(userId)
                    .update({ ...req.body, password: password })
                    .run(req.app._rdbConn, async (err, cursor) => {
                      if (err) throw err;
                      res.status(200).send({ message: "Kullanıcı güncellendi" });
                      await db
                        .table("logs")
                        .insert({ email: user, log: cursor.email + " kullancısı güncellendi!" })
                        .run(req.app._rdbConn);
                    });
                }
              });
          } else {
            password = crypto.createHash("md5").update(req.body.password).digest("hex");
            await db
              .table("users")
              .get(userId)
              .update({ ...req.body, password: password })
              .run(req.app._rdbConn, async (err, cursor) => {
                if (err) throw err;
                res.status(200).send({ message: "Kullanıcı güncellendi" });
                await db
                  .table("logs")
                  .insert({ email: user, log: username + " kullancısı güncellendi!" })
                  .run(req.app._rdbConn);
              });
          }
        });
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
    await db
      .table("users")
      .get(userId)
      .delete({ returnChanges: true })
      .run(req.app._rdbConn, async (err, cursor) => {
        if (err) throw err;
        res.status(200).send({ message: "Kullanıcı silindi" });
        await db
          .table("logs")
          .insert({ email: user, log: cursor.changes[0]["old_val"].email + " kullanıcısı silindi!" })
          .run(req.app._rdbConn);
      });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kullanıcı silme başarısız." });
  }
});

router.get("/logs", checkAuth, async (req, res) => {
  try {
    await db.table("logs").run(req.app._rdbConn, async (err, cursor) => {
      if (err) throw err;
      cursor.toArray(async (err, logs) => {
        if (err) throw err;
        res.status(200).send({ logs: logs });
      });
    });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Loglar getirilemedi." });
  }
});

export default router;
