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
    let supplier = req.body.supplier;
    let result = await db
      .table("products")
      .filter(r.row("name").eq(name).and(r.row("supplier").eq(supplier)))
      .count()
      .eq(1)
      .run(req.app._rdbConn);
    if (result) {
      res.status(400).send({ message: "Bu ürün adı zaten kullanımda." });
    } else {
      let changes = await db.table("products").insert(req.body, { returnChanges: true }).run(req.app._rdbConn);
      if (req.body.type === "box") {
        await db
          .table("stock_logs")
          .insert({
            productId: changes["generated_keys"][0],
            type: "Stok Girişi",
            oldStock: 0,
            newStock: req.body.stock,
          })
          .run(req.app._rdbConn);
      }
      res.status(200).send({ message: "Ürün başarıyla oluşturuldu." });
      let timeStamp = Date.now();
      await db
        .table("logs")
        .insert({ email: user, log: name + " ürün eklendi!", timeStamp: timeStamp })
        .run(req.app._rdbConn);
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/", checkAuth, async (req, res) => {
  try {
    let cursor = await db.table("products").run(req.app._rdbConn);
    let products = await cursor.toArray();
    res.status(200).send({ products: products });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Ürünler getirilemedi." });
  }
});

router.put("/:productId", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    var productId = req.params.productId;
    const name = req.body.name;
    if (!name) {
      res.status(400).send({ message: "Ürün adı boş olamaz!" });
    } else {
      let cursor = await db.table("products").get(productId).run(req.app._rdbConn);
      if (cursor.name !== name) {
        let result = await db.table("products").filter(r.row("name").eq(name)).count().eq(1).run(req.app._rdbConn);
        if (result) {
          res.status(400).send({ message: "Bu ürün zaten kullanımda." });
        } else {
          let cursor = await db.table("products").get(productId).update(req.body).run(req.app._rdbConn);
          res.status(200).send({ message: "Ürün güncellendi" });
          let timeStamp = Date.now();
          await db
            .table("logs")
            .insert({ email: user, log: cursor.name + " ürünü güncellendi!", timeStamp: timeStamp })
            .run(req.app._rdbConn);
        }
      } else {
        await db.table("products").get(productId).update(req.body).run(req.app._rdbConn);
        res.status(200).send({ message: "Ürün güncellendi" });
        let timeStamp = Date.now();
        await db
          .table("logs")
          .insert({ email: user, log: name + " ürünü güncellendi!", timeStamp: timeStamp })
          .run(req.app._rdbConn);
      }
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Ürün güncelleme başarısız." });
  }
});

router.delete("/:productId", checkAuth, async (req, res) => {
  try {
    var productId = req.params.productId;
    let user = req.userData.email;
    let cursor = await db.table("products").get(productId).delete({ returnChanges: true }).run(req.app._rdbConn);
    res.status(200).send({ message: "Ürün silindi" });
    let timeStamp = Date.now();
    await db
      .table("logs")
      .insert({ email: user, log: cursor.changes[0]["old_val"].name + " ürünü silindi!", timeStamp: timeStamp })
      .run(req.app._rdbConn);
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Ürün silme başarısız." });
  }
});

router.post("/package", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    let productId = req.body.id;
    let amount = req.body.amount;
    let stock = 0;
    let result = await db.table("products").get(productId).run(req.app._rdbConn);
    stock = parseInt(result.stock) + parseInt(amount);
    for (let [key, value] of Object.entries(result.content)) {
      let ingridient = await db.table("products").get(key).run(req.app._rdbConn);
      if (ingridient.stock < value * amount) {
        throw new Error("Yeterli " + ingridient.name + " yok.");
      }
      result.content[key] = ingridient.stock - value * amount;
    }
    for (let [key, value] of Object.entries(result.content)) {
      await db.table("products").get(key).update({ stock: value }).run(req.app._rdbConn);
    }
    await db.table("products").get(productId).update({ stock: stock }).run(req.app._rdbConn);
    let timeStamp = Date.now();
    await db
      .table("logs")
      .insert({ email: user, log: result.name + " ürünü paketlendi!", timeStamp: timeStamp })
      .run(req.app._rdbConn);
    res.status(200).send({ message: "Ürün paketlendi" });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

let actionsConstants = {
  add: "Stok Girişi",
  substract: "Stok Çıkışı",
  box: "Ürün Paketleme",
};

router.post("/stocks", checkAuth, async (req, res) => {
  try {
    let log = { ...req.body, type: actionsConstants[req.body.type] };
    await db.table("stock_logs").insert(log).run(req.app._rdbConn);
    res.status(200).send({ message: "Stok güncellendi" });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

export default router;
