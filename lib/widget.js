// widget.js is the script that runs in the ChangeTip iframe and talks back to core.js and the modules
var ChangeTipWidget = {
	init: function() {
		var me = this;

		// set some easily accessible variables for DOM elements we'll need to interact with.
		me.dialogForm = document.querySelector('form');
		me.dialogAvatar = document.getElementById('changeTipDialog-avatar');

		me.dialogInputContainer = completely(document.getElementById('inputContainer'), {
			dropDownBorderColor: '#ddd',
			fontSize: '24px',
			fontFamily: 'sans-serif'
		});
		me.dialogInputContainer.wrapper.classList.add('changeTip-amount');
		me.dialogInputContainer.hint.classList.add('changeTip-amount-hint');
		me.dialogInputContainer.dropDown.classList.add('changeTip-amount-dropdown');

		me.dialogInput = me.dialogInputContainer.input;
		// TODO: add enter key = submit support but not on autocomplete.
		me.dialogInput.setAttribute('type','text');
		me.dialogInput.setAttribute('placeholder', 'Enter your tip amount...');

		me.fiatPreview = document.getElementById('changeTip-fiatPreview');

		me.getMonikers(me.populateMonikers);

		me.dialogInputContainer.onChange = function(text) {
			var words = text.split(' '),
				lastWord = words[words.length-1],
				prevWord = (words.length > 1) ? words[words.length-2] : null,
				digits = /[0-9]+/,
				prevWordIsQty = (prevWord === 'a') || (prevWord === 'an') || (digits.test(prevWord)),
				wordData;

			// if the first word is "a", "an", or all digits,
			// then start listening for autocomplete
			if (prevWordIsQty && text.length > prevWord.length) {
				// TODO: set ChangeTip.tipQty with postmessage - going to have to.
				ChangeTipWidget.tipQty = parseInt(prevWord, 10) || 1;
				if (ChangeTipWidget.tipQty > 1) {
					ChangeTipWidget.dialogInputContainer.options = ChangeTipWidget.monikerCachePlural;
				} else {
					ChangeTipWidget.dialogInputContainer.options = ChangeTipWidget.monikerCacheSingular;
				}
				ChangeTipWidget.dialogInputContainer.startFrom = text.length - lastWord.length;
				ChangeTipWidget.dialogInputContainer.repaint();
			} else {
				ChangeTipWidget.dialogInputContainer.startFrom = 0;
				ChangeTipWidget.dialogInputContainer.options = [];
				ChangeTipWidget.dialogInputContainer.repaint();
			}
			wordData = ChangeTipWidget.getMonikerDataByName(lastWord);
			if (wordData) {
				// do stuff with wordData...
				ChangeTipWidget.updateFiatPreview(wordData);
			}
			return;
		};

		var dialog = document.getElementById('changeTipDialog'),
			w = dialog.offsetWidth,
			h = dialog.offsetHeight,
			message = {
				type: "size",
				data: {
					w: w,
					h: h
				}
			},
			closeButton = document.getElementById("changeTipDialog-closeButton");

		window.top.postMessage(message, "*");
		closeButton.addEventListener("click", ChangeTipWidget.sendCloseMessage, false);

		me.dialogForm.addEventListener("submit", ChangeTipWidget.handleForm, false);


		window.addEventListener("message", ChangeTipWidget.handlePostMessage, false);
		window.addEventListener("keyup", ChangeTipWidget.listenForEscape, false);

		BabelExt.storage.get('lastAmountString', ChangeTipWidget.populateLastAmountString);
	},
	getMonikers: function(callback) {
		if (typeof callback !== 'function') {
			throw "getMonikers called without a callback";
		}
		if (!this.monikerDataCache) {
			BabelExt.xhr({
				url: 'https://'+location.hostname+'/v1/monikers?limit=50',
				onload: function(response) {
					var data;

					try {
						data = JSON.parse(response.responseText);
						ChangeTipWidget.monikerDataCache = data;
						callback(data);
					} catch (e) {
						console.error('moniker data was not valid json:', e.message, data);
					}
				},
				onerror: function() {
					console.log('error retreiving moniker data');
				}
			});
		} else {
			callback(this.monikerDataCache);
		}
	},
	populateMonikers: function(data) {
		var i = 0,
			len = (data.objects) ? data.objects.length : 0;

		// clear out the select box for repopulation
		ChangeTipWidget.monikerCacheSingular = [];
		ChangeTipWidget.monikerCachePlural = [];

		for (; i < len; i++) {
			ChangeTipWidget.monikerCacheSingular.push(data.objects[i].name);
			ChangeTipWidget.monikerCachePlural.push(data.objects[i].plural);
		}

		ChangeTipWidget.monikerCacheSingular.sort();
		ChangeTipWidget.monikerCachePlural.sort();

		// force a parse of the initial value prior to typing/input.
		ChangeTipWidget.dialogInputContainer.onChange(ChangeTipWidget.dialogInput.value);
	},
	getMonikerDataByName: function(name) {
		if (!this.monikerDataCache) {
			throw "No moniker data cache is present. Cannot look up " + name;
		}
		var i = 0,
			len = this.monikerDataCache.objects.length,
			obj;

		// lop off the trailing s for plural requests
		if (ChangeTipWidget.tipQty > 1) {
			if (name.substr(-1) === 's') {
				name = name.substr(0,name.length-1);
			}
		}
		for (; i < len; i++) {
			obj = this.monikerDataCache.objects[i];
			if (obj.name === name) {
				return obj;
			}
		}
	},
	updateFiatPreview: function(wordData) {
		var me = this;
		// TODO: fix this on API side, symbol is coming through empty
		if (wordData.currency.abbreviation === "USD") {
			wordData.currency.symbol = "$";
		}
		me.fiatPreview.textContent = '~' + me.tipQty + 'x' + wordData.currency.symbol + (Math.round(wordData.value * 100) / 100);
	},
	getOneTimeTipLink: function(amount) {
        var xhr = new XMLHttpRequest(),
                csrf = document.getElementById("csrf").value,
                params = 'amount='+amount+'&csrfmiddlewaretoken='+csrf;

        xhr.open('POST', '/once');
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.setRequestHeader("X-CSRFToken", document.getElementById('csrf').value);
        xhr.onreadystatechange = function() {//Call a function when the state changes.
            if(xhr.readyState == 4 && xhr.status == 200) {
                var parsed;
                try {
                    parsed = JSON.parse(xhr.responseText);
                    window.top.postMessage({
                        type: "oneTimeTip",
                        data: {
                            amount: amount,
                            link: parsed.magic_url
                        }
                    }, "*");
                } catch(e) {
                    alert('Error generating tip URL');
                    console.log(xhr.responseText);
                }
            }
        };
        xhr.send(params);
    },
	listenForEscape: function(e) {
	    if (e.keyCode === 27) {
	        ChangeTipWidget.sendCloseMessage();
	    }
	},
	handleForm: function(e) {
        // TODO: only get one time tip link if we're supposed to...
        var amount = ChangeTipWidget.dialogInput.value,
        	oneTimeTip = document.body.getAttribute('data-onetimetip');

        if (oneTimeTip) {
        	ChangeTipWidget.getOneTimeTipLink(amount);
        } else {
        	// send data to parent frame
        	ChangeTipWidget.sendFormData();
        }
        e.preventDefault();
        e.stopPropagation();
    },
    sendFormData: function() {
    	window.top.postMessage({
    		type: "submit",
    		data: {
    			amount: ChangeTipWidget.dialogInput.value
    		}
    	}, "*");
    	ChangeTipWidget.sendCloseMessage();
    },
	sendCloseMessage: function() {
		window.top.postMessage({
			type: "close"
		}, "*");
	},
	populateLastAmountString: function(returnData) {
		ChangeTipWidget.dialogInput.value = returnData.value || '$5';
	}
};
