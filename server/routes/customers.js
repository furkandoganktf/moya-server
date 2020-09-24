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
    let user = req.userData.userName;
    let companyName = req.body.companyName;
    let result = await db.table("customers").filter(r.row("companyName").eq(companyName)).count().eq(1).run(req.app._rdbConn);
    if (result) {
      res.status(400).send({ message: "Bu müşteri adı zaten kullanımda." });
    } else {
      await db.table("customers").insert(req.body).run(req.app._rdbConn);
      res.status(200).send({ message: "Müşteri başarıyla oluşturuldu." });
      let timeStamp = Date.now();
      let date = new Date(timeStamp);
      let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
      await db
        .table("logs")
        .insert({ userName: user, log: companyName + " müşterisi eklendi!", timeStamp: timeStamp, date: dateString })
        .run(req.app._rdbConn);
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/", checkAuth, async (req, res) => {
  try {
    let cursor = await db.table("customers").run(req.app._rdbConn);
    let customers = await cursor.toArray();
    res.status(200).send({ customers: customers });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Müşteriler getirilemedi." });
  }
});

router.put("/:customerId", checkAuth, async (req, res) => {
  try {
    let user = req.userData.userName;
    var customerId = req.params.customerId;
    const companyName = req.body.companyName;
    if (!companyName) {
      res.status(400).send({ message: "Müşteri adı boş olamaz!" });
    } else {
      let cursor = await db.table("customers").get(customerId).run(req.app._rdbConn);
      if (cursor.companyName !== companyName) {
        let result = await db.table("customers").filter(r.row("companyName").eq(companyName)).count().eq(1).run(req.app._rdbConn);
        if (result) {
          res.status(400).send({ message: "Bu müşteri zaten kullanımda." });
        } else {
          let cursor = await db.table("customers").get(customerId).update(req.body).run(req.app._rdbConn);
          res.status(200).send({ message: "Müşteri güncellendi" });
          let timeStamp = Date.now();
          let date = new Date(timeStamp);
          let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
          await db
            .table("logs")
            .insert({ userName: user, log: cursor.companyName + " müşterisi güncellendi!", timeStamp: timeStamp, date: dateString })
            .run(req.app._rdbConn);
        }
      } else {
        await db.table("customers").get(customerId).update(req.body).run(req.app._rdbConn);
        res.status(200).send({ message: "Müşteri güncellendi" });
        let timeStamp = Date.now();
        let date = new Date(timeStamp);
        let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
        await db
          .table("logs")
          .insert({ userName: user, log: companyName + " müşterisi güncellendi!", timeStamp: timeStamp, date: dateString })
          .run(req.app._rdbConn);
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Müşteri güncelleme başarısız." });
  }
});

router.delete("/:customerId", checkAuth, async (req, res) => {
  try {
    var customerId = req.params.customerId;
    let user = req.userData.userName;
    let cursor = await db.table("customers").get(customerId).delete({ returnChanges: true }).run(req.app._rdbConn);
    res.status(200).send({ message: "Müşteri silindi" });
    let timeStamp = Date.now();
    let date = new Date(timeStamp);
    let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
    await db
      .table("logs")
      .insert({ userName: user, log: cursor.changes[0]["old_val"].companyName + " müşterisi silindi!", timeStamp: timeStamp, date: dateString })
      .run(req.app._rdbConn);
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Müşteri silme başarısız." });
  }
});

export default router;
