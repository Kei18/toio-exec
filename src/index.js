const { NearScanner } = require('@toio/scanner');

// read planning
const fs = require('fs');
if (process.argv.length != 4) {
  console.log("planning file is required!");
  console.log("> yarn run app {map_file}.json {planning_result}.json");
  process.exit(0);
}

const PLAN = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const GRID = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const NUM_AGNETS = Object.keys(PLAN).length;
const INTERVAL_MS = 300;
const NIL = -1;
const INIT_TIME_MS = 1500;
const END_TIME_MS = 1500;
const MOVE_SPEED = 80;

// mutual exclusion
let OCCUPIED = new Array(GRID["HEIGHT"]);
for (let y = 0; y < GRID["HEIGHT"]; ++y) {
  OCCUPIED[y] = (new Array(GRID["WIDTH"])).fill(NIL);
}

function getPosFromGridToReal(x, y) {
  return {"x": GRID["CELL_SIZE"] * x + GRID["INIT_COORD_X"],
          "y": GRID["CELL_SIZE"] * y + GRID["INIT_COORD_Y"]};
}

function getPosFromRealToGrid(x, y) {
  let _x = (x - GRID["INIT_COORD_X"]) / GRID["CELL_SIZE"];
  let _y = (y - GRID["INIT_COORD_Y"]) / GRID["CELL_SIZE"];
  if (Math.abs(_x - Math.round(_x)) < GRID["POS_BUF"] && Math.abs(_y - Math.round(_y))) {
    return {"x": Math.round(_x), "y": Math.round(_y)};
  }
  // still moving
  return { "x": NIL, "y": NIL };
}

function move(cube, x, y) {
  OCCUPIED[y][x] = cube.id;
  let target = getPosFromGridToReal(x, y);
  console.log(cube.id, "move to", target);
  cube.moveTo([ target ], {maxSpeed: MOVE_SPEED, moveType: 2});
}

let finish_cnt = 0;

async function exec(cube) {
  console.log(cube.id, "start execution");
  cube.playPresetSound(4);

  let current_loc = { "x": NIL, "y": NIL };
  cube
    .on('id:position-id', data => { current_loc = getPosFromRealToGrid(data["x"], data["y"]); });

  let internal_clock = -1;

  let loop = setInterval(() => {

    // check whether the execution is finished
    if (internal_clock == PLAN[cube.id].length - 1) {
      cube.turnOffLight();
      cube.playPresetSound(2);
      clearInterval(loop);
      console.log(cube.id, "finish execution");
      ++finish_cnt;

      // lighting
      setInterval(() => {
        cube.turnOnLight({ durationMs: INTERVAL_MS, red: 0, green: 255, blue: 0 });
      }, INTERVAL_MS);

      // global termination
      if (finish_cnt == NUM_AGNETS) {
        setTimeout(() => { process.exit(0); }, END_TIME_MS);
      }
      return;
    };

    cube.turnOnLight({ durationMs: INTERVAL_MS, red: 0, green: 0, blue: 255 });

    // get next location
    let next_loc = PLAN[cube.id][internal_clock+1];
    let next_x = next_loc["x"];
    let next_y = next_loc["y"];

    // update occupancy
    if (current_loc["x"] == next_x && current_loc["y"] == next_y) {
      let prev_loc = PLAN[cube.id][internal_clock];
      if (internal_clock >= 0) {
        OCCUPIED[prev_loc["y"]][prev_loc["x"]] = NIL;
      }
      ++internal_clock;
      console.log(cube.id, "clock=", internal_clock, ", loc=", current_loc);
      return;
    }

    // check occupancy
    if (OCCUPIED[next_y][next_x] === NIL || OCCUPIED[next_y][next_x] === cube.id) {
      // move to the next location
      move(cube, next_x, next_y);
    }
  }, INTERVAL_MS);
}

async function main() {
  // connection
  const cubes = await new NearScanner(NUM_AGNETS).start();
  for (let i = 0; i < NUM_AGNETS; ++i) {
    console.log(cubes[i].id, i, "initialize");

    // connect to the cube
    let cube = await cubes[i].connect();

    // initialize location
    let loc = PLAN[cube.id][0];
    move(cube, loc["x"], loc["y"]);
  }
  console.log("---");

  setTimeout(() => {
    // execution
    for (let i = 0; i < NUM_AGNETS; ++i) {
      exec(cubes[i]);
    }
  }, INIT_TIME_MS);
};

main();
