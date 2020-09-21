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
    await db
      .table("products")
      .filter(r.row("name").eq(name).and(r.row("supplier").eq(supplier)))
      .count()
      .eq(1)
      .run(req.app._rdbConn, async (err, result) => {
        if (err) throw err;
        if (result) {
          res.status(400).send({ message: "Bu ürün adı zaten kullanımda." });
        } else {
          await db
            .table("products")
            .insert(req.body)
            .run(req.app._rdbConn, async (err) => {
              if (err) throw err;
              res.status(200).send({ message: "Tedarikçi başarıyla oluşturuldu." });
              await db
                .table("logs")
                .insert({ email: user, log: name + " ürün eklendi!" })
                .run(req.app._rdbConn);
            });
        }
      });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Kayıt başarısız." });
  }
});

router.get("/", checkAuth, async (req, res) => {
  try {
    await db.table("products").run(req.app._rdbConn, async (err, cursor) => {
      if (err) throw err;
      cursor.toArray(async (err, products) => {
        if (err) throw err;
        res.status(200).send({ products: products });
      });
    });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Ürünleer getirilemedi." });
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
      await db
        .table("products")
        .get(productId)
        .run(req.app._rdbConn, async (err, cursor) => {
          if (err) throw err;
          if (cursor.name !== name) {
            await db
              .table("products")
              .filter(r.row("name").eq(name))
              .count()
              .eq(1)
              .run(req.app._rdbConn, async (err, result) => {
                if (err) throw err;
                if (result) {
                  res.status(400).send({ message: "Bu ürün zaten kullanımda." });
                } else {
                  await db
                    .table("products")
                    .get(productId)
                    .update(req.body)
                    .run(req.app._rdbConn, async (err, cursor) => {
                      if (err) throw err;
                      res.status(200).send({ message: "Ürün güncellendi" });
                      await db
                        .table("logs")
                        .insert({ email: user, log: cursor.name + " ürünü güncellendi!" })
                        .run(req.app._rdbConn);
                    });
                }
              });
          } else {
            await db
              .table("products")
              .get(productId)
              .update(req.body)
              .run(req.app._rdbConn, async (err, cursor) => {
                if (err) throw err;
                res.status(200).send({ message: "Ürün güncellendi" });
                await db
                  .table("logs")
                  .insert({ email: user, log: name + " ürünü güncellendi!" })
                  .run(req.app._rdbConn);
              });
          }
        });
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
    await db
      .table("products")
      .get(productId)
      .delete({ returnChanges: true })
      .run(req.app._rdbConn, async (err, cursor) => {
        if (err) throw err;
        res.status(200).send({ message: "Ürün silindi" });
        await db
          .table("logs")
          .insert({ email: user, log: cursor.changes[0]["old_val"].name + " ürünü silindi!" })
          .run(req.app._rdbConn);
      });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Ürün silme başarısız." });
  }
});

export default router;
