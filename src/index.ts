import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);

const server = createServer((_request, response) => {
  response.writeHead(200, {
    "Content-Type": "application/json",
  });

  response.end(
    JSON.stringify({
      name: "KynSight",
      status: "ok",
    }),
  );
});

server.listen(port, () => {
  console.log(`KynSight listening on http://localhost:${port}`);
});
