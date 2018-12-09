
function onLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-off');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).addClass('switch-button-on');
	$('#' + buttonID).addClass('text-white');
	$('#' + buttonID).html('<span class="fa fa-lightbulb-o" aria-hidden="true" id="' + iconID + '"></span> On');
}

function offLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeAttr("disabled", "disabled");
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).removeClass('switch-button-error');
	$('#' + buttonID).removeClass('text-white');
	$('#' + buttonID).addClass('switch-button-off');
	$('#' + buttonID).html('Off');
}

function errorLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	$('#' + buttonID).removeClass('switch-button-on');
	$('#' + buttonID).removeClass('switch-button-off');
	$('#' + buttonID).removeClass('text-white');
	$('#' + buttonID).addClass('switch-button-error');
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).html('<span class="fa fa-exclamation-circle" aria-hidden="true" id="' + iconID + '"></span> Disabled');
	
}

function disableLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	$('#' + buttonID).attr("disabled", "disabled");
	$('#' + buttonID).text('working...');
}

function enableLightButton(device) {
	var buttonID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_button';
	var iconID = device.raspyID + '-' + device.devID + '-' + device.ardID + '_icon';
	var value = devices[device.raspyID][device.ardID][device.devID].value;
	
	$('#' + buttonID).removeAttr("disabled");
	$('#' + buttonID).removeClass('switch-button-error');
	
	if (value == '0') {
		$('#' + buttonID).addClass('switch-button-off');
		$('#' + buttonID).text('Off');
	} else {
		$('#' + buttonID).addClass('switch-button-on');
		$('#' + buttonID).html('<span class="fa fa-lightbulb-o" aria-hidden="true" id="' + iconID + '"></span> On');
	}

}
