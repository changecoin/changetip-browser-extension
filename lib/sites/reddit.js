addModule('reddit', function(module, moduleID) {
	module.moduleName = 'Reddit';
	module.category = 'Site Modules';

	module.init = function() {
		module.pageType = RESUtils.pageType();

		switch(module.pageType) {
			case 'comments':
				$(".usertext-edit textarea").each(function(idx, textarea) {
					module.attachButtonToTextarea(textarea, true);
				});
				$("body").delegate(".usertext-edit textarea", "focus", module.handleEditorFocus);
				break;
			case 'linklist':
				break;
		}
	};

	// the string used to mention changetip on this medium
	module.ctMentionString = '/u/changetip';

	/**
	 * given a tip amount, return a message string to be appended
	 * to the comment reply box using ChangeTip.applyTipTemplate
	 *
	 * @return {string} message to be placed into comment box
	 */
	module.getTipMessage = function(tipAmount) {
		return ChangeTip.applyTipTemplate(tipAmount) + ' ' + module.ctMentionString;
	};

	/**
	 * handle form submission from the ChangTip dialog - this function
	 * should call module.getTipMessage, and place that message in to
	 * the appropriate place
	 */
	module.submit = function(tipAmount) {
		var tipString = module.getTipMessage(tipAmount);

		// add newlines if there's already text in the box...
		if (module.textarea.value) {
			module.textarea.value += "\n\n";
		}
		module.textarea.value += tipString;
		module.textarea.focus();
	};

	/**
	 * If the onCancel function exists, the core changeTip dialog will
	 * call it when the dialog is cancelled
	 */
	module.onCancel = function() {
		module.textarea.focus();
	};

	module.handleEditorFocus = function(e) {
		var existingButton = e.currentTarget.parentNode.querySelector('.changetip-textarea-button');

		if (existingButton) {
			if (existingButton.textarea !== e.target) {
				// remove the button, because it arrives as an imposter via reddit calling .clone()
				e.currentTarget.parentNode.removeChild(existingButton);
				module.attachButtonToTextarea(e.currentTarget);
			}
		} else {
			module.attachButtonToTextarea(e.currentTarget);
		}
	};

	module.attachButtonToTextarea = function(textarea, isTopLevel) {
		if (!textarea) {
			console.log('no textarea provided');
			return;
		}
		var parent = textarea.parentNode,
			tipButton, username;

		// get the username via DOM traversal
		if (!isTopLevel) {
			username = $(textarea).closest('.thing').find('.entry a.author').text();
		} else {
			username = $('#siteTable').find('a.author').text();
		}

		tipButton = module.createTipButton(username);

		// save a reference to the textarea that we're attached to
		tipButton.textarea = textarea;

		// ensure this textarea's parent has position: relative or absolute so that
		// the tip button can be properly aligned. Fortunately, reddit has an empty
		// div around every textarea which serves perfectly as a container for us.
		parent.classList.add('changetip-enabled');

		// reddit has some funky inconsistency on the style of TEXTAREA, so we'll need to do
		// a little bit of trickery here and copy over that margin so our button always aligns
		// correctly. We'll also do math to calculate a proper bottom position.
		//
		// it's a little nasty, but we need a setTimeout here to allow this item to render, otherwise
		// we can't calculate the height.
		//
		// TODO: figure out a way to compensate for subreddit stylesheets that may bork this a bit by
		// adding padding/margins to the textarea or its containing element, etc.
		setTimeout(function() {
			var containerHeight = parseInt(window.getComputedStyle(parent).height),
				textareaHeight = parseInt(window.getComputedStyle(tipButton.textarea).height);

			tipButton.style.bottom = parseInt(containerHeight - textareaHeight + 5) + 'px';
			tipButton.style.marginLeft = window.getComputedStyle(tipButton.textarea).marginLeft;

			parent.appendChild(tipButton);
		}, 100);
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
			pos = RESUtils.getXYpos(tipButton);

		if (!tipButton.textarea) {
			throw "ChangeTip Exception: comment textarea not found";
		}
		module.textarea = tipButton.textarea;

		ChangeTip.openDialog({
			x: pos.x,
			y: pos.y - 15,
			textarea: tipButton.textarea,
			amount: ChangeTip.getSetting('defaultAmount'),
			username: username
		});
		e.preventDefault();
		e.stopPropagation();
	};

});