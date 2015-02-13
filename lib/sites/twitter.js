addModule('twitter', function(module, moduleID) {
	module.moduleName = 'Twitter';
	module.category = 'Site Modules';

	module.init = function() {
		$("body").delegate(".tweet-box.rich-editor", "blur focus", module.handleEditorFocus);
	};

	// the string used to mention changetip on this medium
	module.ctMentionString = '@ChangeTip';

	module.handleEditorFocus = function(e) {
		if (e.type === 'focus') {
			if (!$(e.target).data('changetip-button-added')) {
				// modal tweets are tricky because content isn't yet loaded, so we need to wait.
				setTimeout(function() {
					module.attachButtonToTextarea(e.target);
				}, 50);
			}
			// show the ChangeTip button in case we've hidden it from a blur event
			$(e.target).parent().find('.changetip-textarea-button').show();
			$(e.target).data('changetip-button-added', true);
		} else {
			// hide the ChangeTip button if unfocused, because it looks misplaced in that state
			// there are issues w/this, though, as we need to check state of the ChangeTip dialog, etc.
			setTimeout(function() {
				if (!ChangeTip.dialogIsOpen) {
					$(e.target).parent().find('.changetip-textarea-button').hide();
				}
			}, 50);
		}
	};

	module.attachButtonToTextarea = function(textarea) {
		var parent = textarea.parentNode,
			tipButton, username,
			isBlock, marginBottom, marginLeft;

		// regular timeline tweets
		username = $(textarea).closest('.original-tweet-container').find('.username').text();
		avatar = $(textarea).closest('.original-tweet-container').find('img.avatar');
		if (!username) {
			// modal tweets are tricky because content isn't yet loaded...
			username = $(textarea).closest('div.modal-content').find('.username').text();
			avatar = $(textarea).closest('div.modal-content').find('img.avatar');
		}
		if (!username) {
			// permalink tweets
			username = $(textarea).closest('#page-container.wrapper-permalink').find('.username').text();
			avatar = $(textarea).closest('#page-container.wrapper-permalink').find('img.avatar');
		}
		if (!username) {
			// for now, don't create the button if username isn't found.
			console.log('username not found');
			console.log(textarea);
			return;
		}
		tipButton = module.createTipButton(username);

		// save a reference to the textarea that we're attached to
		tipButton.textarea = textarea;

		tipButton.classList.add('twitter');

		// ensure this textarea's parent has position: relative or absolute so that
		// the tip button can be properly aligned. Fortunately, reddit has an empty 
		// div around every textarea which serves perfectly as a container for us.
		parent.classList.add('changetip-enabled');
		parent.appendChild(tipButton);

	};

	module.createTipButton = function(username) {
		var tipButton = Utils.createElement('a', null, 'changetip-button changetip-textarea-button');

		if (username === 'changetip') {
			return;
		}

		tipButton.textContent = 'ChangeTip';
		// remove from tabindex or it hijacks and makes "tab, enter" no longer work for submitting posts.
		tipButton.setAttribute('tabindex', '-1');
		tipButton.setAttribute('href','#tip');
		tipButton.setAttribute('data-username', username);
		tipButton.setAttribute('title', 'send a tip to ' + username);
		tipButton.addEventListener('click', module.tipViaComment, false);

		return tipButton;
	};

	module.tipViaComment = function(e) {
		var tipButton = e.target,
			username = tipButton.getAttribute('data-username'),
			pos = RESUtils.getXYpos(tipButton),
			fixed = false;

		if (!tipButton.textarea) {
			throw "ChangeTip Exception: comment textarea not found";
		}
		// twitter has a fun situation where modal tweets cause the BODY tag
		// to not actually have a full/legit height, which breaks absolute XY
		// positioning of the dialog, so we need to set position to fixed.
		if (document.body.classList.contains('.modal-enabled')) {
			fixed = true;
		}
		module.textarea = tipButton.textarea;

		ChangeTip.openDialog({
			x: pos.x,
			y: pos.y - 15,
			fixed: fixed,
			textarea: tipButton.textarea,
			amount: ChangeTip.getSetting('defaultAmount'),
			username: username
		});
		e.preventDefault();
		e.stopPropagation();
	};

	/**
	 * given a tip amount, return a message string to be appended
	 * to the comment reply box using ChangeTip.applyTipTemplate
	 * 
	 * @return {string} message to be placed into comment box
	 */
	module.getTipMessage = function(tipAmount) {
		// we're not using the template here because on twitter, replies already start
		// with @username, and that would be redundant. 
		// 
		// TODO: maybe we need templates per site?
		// 
		// return ChangeTip.applyTipTemplate(tipAmount) + ' ' + module.ctMentionString;
		return 'have ' + tipAmount + ' on me! ' + module.ctMentionString;
	};

	/**
	 * handle form submission from the ChangTip dialog - this function
	 * should call module.getTipMessage, and place that message in to
	 * the appropriate place
	 */
	module.submit = function(tipAmount) {
		var tipString = module.getTipMessage(tipAmount),
			text;

		// focus the textarea immediately, because twitter is going to do some DOM swapping that
		// needs to happen before we attempt to manipulate the text.
		module.textarea.focus();
		
		// get the existing textcontent (filter out the HTML, as twitter will re-assemble it),
		// and append the tipString.
		text = module.textarea.textContent;

		// we add an extra space to the end to avoid the auto complete popups after the @mention
		text = text + tipString + ' ';

		module.textarea.innerHTML = text;
	};

	/**
	 * If the onCancel function exists, the core changeTip dialog will
	 * call it when the dialog is cancelled
	 */
	module.onCancel = function() {
		module.textarea.focus();
	};

});