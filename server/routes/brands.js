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
    let name = req.body.name;
    let result = await db.table("brands").filter(r.row("name").eq(name)).count().eq(1).run(req.app._rdbConn);
    if (result) {
      res.status(400).send({ message: "Bu marka adı zaten kullanımda." });
    } else {
      await db.table("brands").insert(req.body).run(req.app._rdbConn);
      res.status(200).send({ message: "Marka başarıyla oluşturuldu." });
      let timeStamp = Date.now();
      let date = new Date(timeStamp);
      let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
      await db
        .table("logs")
        .insert({ userName: user, log: name + " markası eklendi!", timeStamp: timeStamp, date: dateString })
        .run(req.app._rdbConn);
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/", checkAuth, async (req, res) => {
  try {
    let cursor = await db.table("brands").run(req.app._rdbConn);
    let brands = await cursor.toArray();
    res.status(200).send({ brands: brands });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Markalar getirilemedi." });
  }
});

router.put("/:brandId", checkAuth, async (req, res) => {
  try {
    let user = req.userData.userName;
    var brandId = req.params.brandId;
    const name = req.body.name;
    if (!name) {
      res.status(400).send({ message: "Marka adı boş olamaz!" });
    } else {
      let cursor = await db.table("brands").get(brandId).run(req.app._rdbConn);
      if (cursor.name !== name) {
        let result = await db.table("brands").filter(r.row("name").eq(name)).count().eq(1).run(req.app._rdbConn);
        if (result) {
          res.status(400).send({ message: "Bu marka zaten kullanımda." });
        } else {
          let cursor = await db.table("brands").get(brandId).update(req.body).run(req.app._rdbConn);
          res.status(200).send({ message: "Marka güncellendi" });
          let timeStamp = Date.now();
          let date = new Date(timeStamp);
          let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
          await db
            .table("logs")
            .insert({ userName: user, log: cursor.name + " markası güncellendi!", timeStamp: timeStamp, date: dateString })
            .run(req.app._rdbConn);
        }
      } else {
        await db.table("brands").get(brandId).update(req.body).run(req.app._rdbConn);
        res.status(200).send({ message: "Marka güncellendi" });
        let timeStamp = Date.now();
        let date = new Date(timeStamp);
        let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
        await db
          .table("logs")
          .insert({ userName: user, log: name + " markası güncellendi!", timeStamp: timeStamp, date: dateString })
          .run(req.app._rdbConn);
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Marka güncelleme başarısız." });
  }
});

router.delete("/:brandId", checkAuth, async (req, res) => {
  try {
    var brandId = req.params.brandId;
    let user = req.userData.userName;
    let cursor = await db.table("brands").get(brandId).delete({ returnChanges: true }).run(req.app._rdbConn);
    res.status(200).send({ message: "Marka silindi" });
    let timeStamp = Date.now();
    let date = new Date(timeStamp);
    let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
    await db
      .table("logs")
      .insert({ userName: user, log: cursor.changes[0]["old_val"].name + " markası silindi!", timeStamp: timeStamp, date: dateString })
      .run(req.app._rdbConn);
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Marka silme başarısız." });
  }
});

export default router;
