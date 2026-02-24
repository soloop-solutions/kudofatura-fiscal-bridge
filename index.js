const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const CONFIG_PATH = path.join(__dirname, "config.json");

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function createPrinter(config) {
  const middleware = config.middleware || config.brand;

  switch (middleware) {
    case "erpnet": {
      const { ErpNetPrinter } = require("./lib/printers/erpnet");
      return new ErpNetPrinter(config);
    }
    case "datecs":
    case "datecs-serial": {
      const { DatecsPrinter } = require("./lib/printers/datecs");
      return new DatecsPrinter(config);
    }
    case "tremol":
    case "zfplab": {
      const { TremolPrinter } = require("./lib/printers/tremol-zfplab");
      return new TremolPrinter(config);
    }
    default:
      throw new Error(`Unknown printer middleware/brand: ${middleware}`);
  }
}

let printer = null;

function getPrinter() {
  if (!printer) {
    const config = loadConfig();
    printer = createPrinter(config);
  }
  return printer;
}

// --- Routes ---

app.get("/status", async (req, res) => {
  try {
    const p = getPrinter();
    const status = await p.getStatus();
    const config = loadConfig();
    res.json({
      bridge: "ok",
      version: "1.0.0",
      printer: status,
      config: {
        brand: config.brand,
        middleware: config.middleware,
        port: config.port,
      },
    });
  } catch (err) {
    res.json({
      bridge: "ok",
      version: "1.0.0",
      printer: { ok: false, statusText: err.message },
    });
  }
});

app.post("/receipt", async (req, res) => {
  try {
    const p = getPrinter();
    const result = await p.printReceipt(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/void-receipt", async (req, res) => {
  try {
    const p = getPrinter();
    const result = await p.voidReceipt();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/x-report", async (req, res) => {
  try {
    const p = getPrinter();
    const result = await p.xReport();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/z-report", async (req, res) => {
  try {
    const p = getPrinter();
    const result = await p.zReport();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/config", (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/config", (req, res) => {
  try {
    const config = { ...loadConfig(), ...req.body };
    saveConfig(config);
    // Reset printer instance so next call uses new config
    printer = null;
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/paper-status", async (req, res) => {
  try {
    const p = getPrinter();
    const status = await p.getPaperStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Start Server ---

const HOST = "127.0.0.1";
const PORT = 7878;

app.listen(PORT, HOST, () => {
  console.log(`[Fiscal Bridge] Running on http://${HOST}:${PORT}`);
  console.log(`[Fiscal Bridge] Config: ${CONFIG_PATH}`);
});
