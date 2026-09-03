let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  try {
    const j = JSON.parse(s);
    console.log(`${j.readyState} | ${j.target} | ${(j.aliases || [])[0] ?? "sem alias"}`);
  } catch {
    console.log("sem resposta");
  }
});
