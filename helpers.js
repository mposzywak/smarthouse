

/**
 *	Function generating count long random string
 */
function generate(count) {
    var founded = false,
    _sym = 'abcdefghijklmnopqrstuvwxyz1234567890',
    str = '';
    
	for(var i = 0; i < count; i++) {
        str += _sym[parseInt(Math.random() * (_sym.length))];
    }
	
    return str;
}

module.exports.generate = generate;