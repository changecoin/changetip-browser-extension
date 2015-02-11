addModule('reddit', function(module, moduleID) {
	module.moduleName = 'Reddit';
	module.category = 'Site Modules';

	module.init = function() {
		module.pageType = RESUtils.pageType();
		RESUtils.initObservers();
		RESUtils.watchForElement('newCommentsForms', module.handleNewCommentsForm);
		// we are going to remove these observers for now with our new textarea approach
		// RESUtils.watchForElement('newComments', module.handleComments);

		switch(module.pageType) {
			case 'comments':
				module.handleComments();
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

	/**
	 * Attach a tip button to comments
	 * 
	 * @return {[type]} [description]
	 */
	module.handleComments = function(ele) {
		var element = ele || document.body,
			initialTextarea,
			postTipButton;

		// if ele is not present, we're scanning the whole page, get the
		// info from the post.
		if (!ele) {
			// get the initial, pre-existing textarea for a reply to the post itself
			initialTextarea = document.body.querySelector('.commentarea textarea');
			module.attachButtonToTextarea(initialTextarea, true);
		}
	};

	module.handleNewCommentsForm = function(commentsForm) {
		var textarea;
		if (commentsForm.tagName === 'FORM') {
			// single form
			textarea = commentsForm.querySelector('textarea');
			module.attachButtonToTextarea(textarea);
		} else {
			commentsForm.forEach(function(commentsForm) {
				textarea = commentsForm.querySelector('textarea');
				module.attachButtonToTextarea(textarea);
			});
		}
	};

	module.attachButtonToTextarea = function(textarea, isTopLevel) {
		if (!textarea) {
			console.log('no textarea provided');
			return;
		}
		var parent = textarea.parentNode,
			tipButton, username;

		if (parent.classList.contains('changetip-enabled')) {
			// this is a nasty but necessary little bit of code.
			//
			// reddit uses "clone" when creating new textareas, which would give a new textarea 
			// this class as well. We'll want to remove the associated tip button and re-add it.
			parent.removeChild(parent.querySelector('.changetip-button'));
			console.log('remove the nasty');
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