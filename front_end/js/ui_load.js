
/* file for loading HTML UI feature through JS */

/* load common to all pages navbar*/
function loadNavbar(item) {
	
	var navbar = '    <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark"> \
      <a class="navbar-brand" href="#">Navigation</a> \
      <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation"> \
        <span class="navbar-toggler-icon"></span> \
      </button> \
      <div class="collapse navbar-collapse" id="navbarCollapse"> \
        <ul class="navbar-nav mr-auto"> \
          <li id="device-configuration" class="nav-item"> \
            <a class="nav-link" href="/device-configuration">Configuration</a> \
          </li> \
          <li id="device-discovery" class="nav-item"> \
            <a class="nav-link" href="/device-discovery">Device Discovery</a> \
          </li> \
          <li id="device-active" class="nav-item"> \
            <a class="nav-link" href="/device-active">Active Devices</a> \
          </li> \
          <li id="user" class="nav-item dropdown"> \
            <a class="nav-link dropdown-toggle" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false">User</a> \
              <div class="dropdown-menu"> \
              	<a class="dropdown-item" href="/settings">Settings & Connection Status</a> \
                <div class="dropdown-divider"></div> \
                <a class="dropdown-item" id="logout" href="/logout"><span class="fa fa-sign-out" aria-hidden="true"></span> Logout</a> \
              </div> \
          </li> \
        </ul> \
      </div> \
    </nav> \
	';
			   
	$("body").prepend(navbar);
	$("#" + item).addClass("active");
}