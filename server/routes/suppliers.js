import express from "express";
import dotenv from "dotenv";
import r from "rethinkdb";
import checkAuth from "../middleware/checkAuth";
import { print } from "../helpers/printErrors";
var router = express.Router();

dotenv.config();

const db = r.db("moya");

router.post("/", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    let name = req.body.name;
    let result = await db.table("suppliers").filter(r.row("name").eq(name)).count().eq(1).run(req.app._rdbConn);
    if (result) {
      res.status(400).send({ message: "Bu tedarikçi adı zaten kullanımda." });
    } else {
      await db.table("suppliers").insert(req.body).run(req.app._rdbConn);
      res.status(200).send({ message: "Tedarikçi başarıyla oluşturuldu." });
      let timeStamp = Date.now();
      await db
        .table("logs")
        .insert({ email: user, log: name + " tedarikçisi eklendi!", timeStamp: timeStamp })
        .run(req.app._rdbConn);
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/", checkAuth, async (req, res) => {
  try {
    let cursor = await db.table("suppliers").run(req.app._rdbConn);
    let suppliers = await cursor.toArray();
    res.status(200).send({ suppliers: suppliers });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Tedarikçiler getirilemedi." });
  }
});

router.put("/:supplierId", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    var supplierId = req.params.supplierId;
    const name = req.body.name;
    if (!name) {
      res.status(400).send({ message: "Tedarikçi adı boş olamaz!" });
    } else {
      let cursor = await db.table("suppliers").get(supplierId).run(req.app._rdbConn);
      if (cursor.name !== name) {
        let result = await db.table("suppliers").filter(r.row("name").eq(name)).count().eq(1).run(req.app._rdbConn);
        if (result) {
          res.status(400).send({ message: "Bu tedarikçi zaten kullanımda." });
        } else {
          let cursor = await db.table("suppliers").get(supplierId).update(req.body).run(req.app._rdbConn);
          res.status(200).send({ message: "Tedarikçi güncellendi" });
          let timeStamp = Date.now();
          await db
            .table("logs")
            .insert({ email: user, log: cursor.name + " tedarikçisi güncellendi!", timeStamp: timeStamp })
            .run(req.app._rdbConn);
        }
      } else {
        await db.table("suppliers").get(supplierId).update(req.body).run(req.app._rdbConn);
        res.status(200).send({ message: "Tedarikçi güncellendi" });
        let timeStamp = Date.now();
        await db
          .table("logs")
          .insert({ email: user, log: name + " tedarikçisi güncellendi!", timeStamp: timeStamp })
          .run(req.app._rdbConn);
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Tedarikçi güncelleme başarısız." });
  }
});

router.delete("/:supplierId", checkAuth, async (req, res) => {
  try {
    var supplierId = req.params.supplierId;
    let user = req.userData.email;
    let cursor = await db.table("suppliers").get(supplierId).delete({ returnChanges: true }).run(req.app._rdbConn);
    res.status(200).send({ message: "Tedarikçi silindi" });
    let timeStamp = Date.now();
    await db
      .table("logs")
      .insert({ email: user, log: cursor.changes[0]["old_val"].name + " tedarikçisi silindi!", timeStamp: timeStamp })
      .run(req.app._rdbConn);
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Tedarikçi silme başarısız." });
  }
});

export default router;
