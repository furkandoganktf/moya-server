import express from "express";
import dotenv from "dotenv";
import r from "rethinkdb";
import checkAuth from "../middleware/checkAuth";
import { print } from "../helpers/printErrors";
var router = express.Router();
import { exec } from "child_process";

dotenv.config();
const api = process.env.API;
const domain = process.env.DOMAIN;

const db = r.db("moya");

let actionsConstants = {
  add: "Stok Girişi",
  substract: "Stok Çıkışı",
  box: "Ürün Paketleme",
};

let typeConstants = {
  box: "Kutulu Ürün",
  material: "Hammadde",
  package: "Ambalaj",
};

let sendEmail = (message) => {
  exec(
    `curl -s --user 'api:${api}' ${domain} \
  -F from='mailgun@mg.moyaoto.com.tr' \
  -F to='metin@feynlab.com.tr' \
  -F to='burak@matrixmc.com.tr' \
  -F to='sezer@matrixmc.com.tr' \
  -F to='oiyigungor@filmandfoil.com.tr' \
  -F subject='Stok Limiti' \
  -F text='${message}'`,
    (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    }
  );
};

router.post("/", checkAuth, async (req, res) => {
  try {
    let user = req.userData.userName;
    let name = req.body.name;
    let supplier = req.body.supplier;
    let type = req.body.type;
    let result = await db.table("products").filter({ name: name, supplier: supplier, type: type }).count().eq(1).run(req.app._rdbConn);
    if (result) {
      res.status(400).send({ message: "Bu ürün adı zaten kullanımda." });
    } else {
      let changes = await db.table("products").insert(req.body, { returnChanges: true }).run(req.app._rdbConn);
      let timeStamp = Date.now();
      let date = new Date(timeStamp);
      let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
      await db
        .table("stock_logs")
        .insert({
          productId: changes["generated_keys"][0],
          type: "Stok Girişi",
          productType: typeConstants[type],
          oldStock: 0,
          newStock: req.body.stock,
          timeStamp: timeStamp,
          date: dateString,
        })
        .run(req.app._rdbConn);
      res.status(200).send({ message: "Ürün başarıyla oluşturuldu." });
      await db
        .table("logs")
        .insert({ userName: user, log: name + " ürün eklendi!", timeStamp: timeStamp, date: dateString })
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
    let user = req.userData.userName;
    var productId = req.params.productId;
    const name = req.body.name;
    let newStock = req.body.stock;
    if (!name) {
      res.status(400).send({ message: "Ürün adı boş olamaz!" });
    } else {
      let cursor = await db.table("products").get(productId).run(req.app._rdbConn);
      if (cursor.name !== name) {
        let result = await db.table("products").filter(r.row("name").eq(name)).count().eq(1).run(req.app._rdbConn);
        if (result) {
          res.status(400).send({ message: "Bu ürün zaten kullanımda." });
        } else {
          await db.table("products").get(productId).update(req.body).run(req.app._rdbConn);
          res.status(200).send({ message: "Ürün güncellendi" });
          if (parseInt(newStock) <= parseInt(cursor.threshold)) {
            sendEmail(`${cursor.name} isimli ürün belirlenen limitin altında. Güncel stok: ${newStock}`);
          }
          let timeStamp = Date.now();
          let date = new Date(timeStamp);
          let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
          await db
            .table("logs")
            .insert({ userName: user, log: cursor.name + " ürünü güncellendi!", timeStamp: timeStamp, date: dateString })
            .run(req.app._rdbConn);
        }
      } else {
        await db.table("products").get(productId).update(req.body).run(req.app._rdbConn);
        res.status(200).send({ message: "Ürün güncellendi" });
        if (parseInt(newStock) <= parseInt(cursor.threshold)) {
          sendEmail(`${cursor.name} isimli ürün belirlenen limitin altında. Güncel stok: ${newStock}`);
        }
        let timeStamp = Date.now();
        let date = new Date(timeStamp);
        let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
        await db
          .table("logs")
          .insert({ userName: user, log: name + " ürünü güncellendi!", timeStamp: timeStamp, date: dateString })
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
    let user = req.userData.userName;
    let cursor = await db.table("products").get(productId).delete({ returnChanges: true }).run(req.app._rdbConn);
    res.status(200).send({ message: "Ürün silindi" });
    let timeStamp = Date.now();
    let date = new Date(timeStamp);
    let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
    await db
      .table("logs")
      .insert({ userName: user, log: cursor.changes[0]["old_val"].name + " ürünü silindi!", timeStamp: timeStamp, date: dateString })
      .run(req.app._rdbConn);
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Ürün silme başarısız." });
  }
});

router.post("/package", checkAuth, async (req, res) => {
  try {
    let user = req.userData.userName;
    let productId = req.body.id;
    let amount = req.body.amount;
    let stock = 0;
    let timeStamp = Date.now();
    let date = new Date(timeStamp);
    let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
    let result = await db.table("products").get(productId).run(req.app._rdbConn);
    stock = parseInt(result.stock) + parseInt(amount);
    let newStocks = {};
    for (let [key, value] of Object.entries(result.content)) {
      let ingridient = await db.table("products").get(key).run(req.app._rdbConn);
      if (ingridient.stock < value * amount) {
        throw new Error("Yeterli " + ingridient.name + " yok.");
      }
      newStocks[key] = ingridient.stock - value * amount;
    }
    for (let [key, value] of Object.entries(newStocks)) {
      let product = await db.table("products").get(key).run(req.app._rdbConn);
      await db
        .table("stock_logs")
        .insert({
          newStock: value,
          oldStock: product.stock,
          productId: product.id,
          productName: product.name,
          type: actionsConstants["box"],
          productType: typeConstants[product.type],
          timeStamp: timeStamp,
          date: dateString,
        })
        .run(req.app._rdbConn);
      if (parseInt(value) <= parseInt(product.threshold)) {
        sendEmail(`${product.name} isimli ürün belirlenen limitin altında. Güncel stok: ${value}`);
      }
      await db.table("products").get(key).update({ stock: value }).run(req.app._rdbConn);
    }
    await db.table("products").get(productId).update({ stock: stock }).run(req.app._rdbConn);
    await db
      .table("logs")
      .insert({ userName: user, log: result.name + " ürünü paketlendi!", timeStamp: timeStamp, date: dateString })
      .run(req.app._rdbConn);
    res.status(200).send({ message: "Ürün paketlendi" });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.post("/stocks", checkAuth, async (req, res) => {
  try {
    let timeStamp = Date.now();
    let date = new Date(timeStamp);
    let dateString = date.toLocaleDateString("tr-TR") + " " + date.toLocaleTimeString("tr-TR");
    let log = {
      ...req.body,
      type: actionsConstants[req.body.type],
      productType: typeConstants[req.body.productType],
      timeStamp: timeStamp,
      date: dateString,
    };
    await db.table("stock_logs").insert(log).run(req.app._rdbConn);
    res.status(200).send({ message: "Stok güncellendi" });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

export default router;
