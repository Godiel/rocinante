// Rocinante: if the interface did not start (one of its files failed to load, as can happen in
// development after the app was killed), the window would stay blank. Five seconds after loading,
// an empty window is loaded once more; the interface then notes it in the log.
(function () {
  var KEY = "rocinante-boot-retry";
  setTimeout(function () {
    var root = document.getElementById("root");
    try {
      if (root && root.childElementCount > 0) {
        sessionStorage.removeItem(KEY);
        return;
      }
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch (error) {
      return;
    }
    location.reload();
  }, 5000);
})();
