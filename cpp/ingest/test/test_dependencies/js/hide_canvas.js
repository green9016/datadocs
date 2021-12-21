if (Module['preRun'] instanceof Array) {
  Module['preRun'].push(hide_canvas);
} else {
  Module['preRun'] = [hide_canvas];
}

function hide_canvas()
{
  let canvas = document.querySelector('#canvas');
  canvas.style.display = "none";
  let output = document.querySelector('#output');
  output.style.height = "100%";
  output.rows = 25;
}
