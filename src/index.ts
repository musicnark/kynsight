import { CompaniesHouseClient } from "./companies-house/client.js";
import { AssessmentService } from "./assessment/service.js";
import { AssessmentStore } from "./assessment/store.js";
import { VettQueue } from "./assessment/queue.js";
import { createKynSightServer } from "./http/server.js";
import { VettClient } from "./vett/client.js";

const port = Number(process.env.PORT ?? 3000);
const store = new AssessmentStore();
const companiesHouseClient = new CompaniesHouseClient({
  apiKey: process.env.COMPANIES_HOUSE_API_KEY ?? "",
});
const vettClient = new VettClient({
  apiKey: process.env.RAPIDAPI_KEY ?? "",
});
const queue = new VettQueue(store, vettClient);
const assessmentService = new AssessmentService({
  companiesHouseClient,
  queue,
  store,
});

const server = createKynSightServer({ assessmentService });

server.listen(port, () => {
  console.log(`KynSight listening on http://localhost:${port}`);
});
