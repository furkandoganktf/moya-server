import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import cors from "cors";
import indexRouter from "./routes/index";
import customerRouter from "./routes/customers";
import supplierRouter from "./routes/suppliers";
import productRouter from "./routes/products";

var app = express();

app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));
app.use("/", indexRouter);
app.use("/customers", customerRouter);
app.use("/suppliers", supplierRouter);
app.use("/products", productRouter);

export default app;
