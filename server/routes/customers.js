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
    let companyName = req.body.companyName;
    await db
      .table("customers")
      .filter(r.row("companyName").eq(companyName))
      .count()
      .eq(1)
      .run(req.app._rdbConn, async (err, result) => {
        if (err) throw err;
        if (result) {
          res.status(400).send({ message: "Bu müşteri adı zaten kullanımda." });
        } else {
          await db
            .table("customers")
            .insert(req.body)
            .run(req.app._rdbConn, async (err) => {
              if (err) throw err;
              res.status(200).send({ message: "Müşteri başarıyla oluşturuldu." });
              await db
                .table("logs")
                .insert({ email: user, log: companyName + " müşterisi eklendi!" })
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
    await db.table("customers").run(req.app._rdbConn, async (err, cursor) => {
      if (err) throw err;
      cursor.toArray(async (err, customers) => {
        if (err) throw err;
        res.status(200).send({ customers: customers });
      });
    });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Müşteriler getirilemedi." });
  }
});

router.put("/:customerId", checkAuth, async (req, res) => {
  try {
    let user = req.userData.email;
    var customerId = req.params.customerId;
    const companyName = req.body.companyName;
    if (!companyName) {
      res.status(400).send({ message: "Müşteri adı boş olamaz!" });
    } else {
      await db
        .table("customers")
        .get(customerId)
        .run(req.app._rdbConn, async (err, cursor) => {
          if (err) throw err;
          if (cursor.companyName !== companyName) {
            await db
              .table("customers")
              .filter(r.row("companyName").eq(companyName))
              .count()
              .eq(1)
              .run(req.app._rdbConn, async (err, result) => {
                if (err) throw err;
                if (result) {
                  res.status(400).send({ message: "Bu müşteri zaten kullanımda." });
                } else {
                  await db
                    .table("customers")
                    .get(customerId)
                    .update(req.body)
                    .run(req.app._rdbConn, async (err, cursor) => {
                      if (err) throw err;
                      res.status(200).send({ message: "Müşteri güncellendi" });
                      await db
                        .table("logs")
                        .insert({ email: user, log: cursor.companyName + " müşterisi güncellendi!" })
                        .run(req.app._rdbConn);
                    });
                }
              });
          } else {
            await db
              .table("customers")
              .get(customerId)
              .update(req.body)
              .run(req.app._rdbConn, async (err, cursor) => {
                if (err) throw err;
                res.status(200).send({ message: "Müşteri güncellendi" });
                await db
                  .table("logs")
                  .insert({ email: user, log: companyName + " müşterisi güncellendi!" })
                  .run(req.app._rdbConn);
              });
          }
        });
    }
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Müşteri güncelleme başarısız." });
  }
});

router.delete("/:customerId", checkAuth, async (req, res) => {
  try {
    var customerId = req.params.customerId;
    let user = req.userData.email;
    await db
      .table("customers")
      .get(customerId)
      .delete({ returnChanges: true })
      .run(req.app._rdbConn, async (err, cursor) => {
        if (err) throw err;
        res.status(200).send({ message: "Müşteri silindi" });
        await db
          .table("logs")
          .insert({ email: user, log: cursor.changes[0]["old_val"].companyName + " müşterisi silindi!" })
          .run(req.app._rdbConn);
      });
  } catch (error) {
    print(error);
    res.status(400).send({ message: "Müşteri silme başarısız." });
  }
});

export default router;
