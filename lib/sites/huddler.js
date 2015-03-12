addModule('huddler', function(module, moduleID) {
	module.moduleName = 'Huddler';
	module.category = 'Site Modules';

	module.usesIframe = true; // this module will use an iframe due to CSRF and referer protection

	module.init = function() {
		var isForumPage = location.pathname.match(/^\/t\//i),
			isGalleryPage = location.pathname.match(/^\/g\//i),
			isUserPage = location.pathname.match(/^\/u\//i),
			isComposePage = location.pathname.match(/^\/messages\/messages\/compose\/u\/(\d+)/i);

		// forum urls and the compose message page
		if (isForumPage || isGalleryPage || isUserPage || isComposePage) {
			// find message dialogs
			$("body").delegate(".yui3-widget.yui3-panel .cke_editable, #main-container.messages-section .cke_editable", "focus", module.handleEditorFocus);
			$("body").delegate(".HM-user-menu", "mouseover", function(e) {
				Utils.debounce(module.updateUserHoverPanel(e), 100);
			});

			if (isComposePage && location.search === '?ChangeTip=true') {
				// focus the textarea and activate the changetip button automatically
				module.doTipOnFocus = true;
				$('#message-subject').val("thanks for the great content, here's a tip via ChangeTip!");
				module.focusTextareaWhenReady();
			}

			if (isUserPage) {
				// add a tip button to the left pane
				module.updateUserPanel();
			}
		} else {
			// find links to user profiles and add a tip button next to them
			$('article a[href^="/u/"], .article-byline a[href^="/u/"]').each(module.addAuthorTipButton);
		}
	};

	// the string used to mention changetip on this medium
	// in the case of huddler, we won't have a mention string for now. Tips will be private.
	module.ctMentionString = '';

	/**
	 * given a tip amount, return a message string to be appended
	 * to the comment reply box using ChangeTip.applyTipTemplate
	 *
	 * @return {string} message to be placed into comment box
	 */
	module.getTipMessage = function(tipAmount, tipLink) {
		return ChangeTip.applyTipTemplate(tipAmount) + ' collect it at: ' + tipLink;
	};

	module.updateUserHoverPanel = function(e) {
		var username = $(e.currentTarget).text(),
			$tipItem = $('.UserDropdownWidget').find('.sendChangeTip'),
			$pmItem = $('.UserDropdownWidget').find('.sendPm'),
			$tipLink;

		if ($tipItem) {
			$tipItem.remove();
		}
		$tipItem = $pmItem.clone();
		$tipItem.attr('class','sendChangeTip');
		$tipItem.attr('id','changetip-huddler-link');
		$tipLink = $tipItem.find('a');
		// we keep the sendPm class so that the action is triggered by their YUI script.
		$tipLink.attr('class','changetip-huddler-icon H-userMenu-sendPm');
		$tipLink.attr('style', "background: url(" + ChangeTip.sendImgURL + ") no-repeat 4px 2px / 14px 14px; ");
		$tipLink.text('Send Tip to ' + username);
		$tipLink.on('click', function(e) {
			module.doTipOnFocus = true;
			module.focusTextareaWhenReady();
		});
		$pmItem.after($tipItem);
	};

	module.updateUserPanel = function() {
		var username = $('h1.profile-header').text(),
			$tipItem = $('.sub-pm-user').find('.sendChangeTip'),
			$pmItem = $('.sub-pm-user').find('.icon-user-menu-send-pm').parent(),
			$tipLink;

		if ($tipItem) {
			$tipItem.remove();
		}
		$tipItem = $pmItem.clone();
		$tipItem.attr('class','sendChangeTip');
		$tipItem.attr('id','changetip-huddler-link');
		$tipLink = $tipItem.find('a');
		// we keep the sendPm class so that the action is triggered by their YUI script.
		$tipLink.attr('class','changetip-huddler-icon H-userMenu-sendPm');
		$tipLink.attr('style', "background: url(" + ChangeTip.sendImgURL + ") no-repeat 4px 2px / 14px 14px; ");
		$tipLink.text('Send Tip to ' + username);
		$tipLink.on('click', function(e) {
			module.doTipOnFocus = true;
			module.focusTextareaWhenReady();
		});
		$pmItem.after($tipItem);
	};

	module.focusTextareaWhenReady = function() {
		var $textarea = $('.yui3-widget.yui3-panel .cke_editable, .messages-section .cke_editable');
		if (!$textarea || $textarea.length === 0) {
			setTimeout(module.focusTextareaWhenReady, 100);
		} else {
			$textarea.focus();
		}
	};

	module.addAuthorTipButton = function(idx, item) {
		var tipButton, href, userid, username;

		// if class .thumb is present, this is an avatar/image, don't add a link.
		if ($(item).hasClass('thumb')) {
			return;
		}
		username = item.textContent;
		userid = $(item).attr('href').match(/\/u\/(\d+)/i).pop();
		tipButton = module.createArticleTipButton(userid, username);
		$(item).after(tipButton);
	};

	/**
	 * handle form submission from the ChangTip dialog - this function
	 * should call module.getTipMessage, and place that message in to
	 * the appropriate place
	 */
	module.submit = function(tipAmount) {
		// no op since iframe
		return true;
	};

	module.handleOneTimeTipLink = function(message) {
		var amount = message.data.amount,
			link = message.data.link,
			tipString = module.getTipMessage(amount, link);

		ChangeTip.closeDialog();

		// add newlines if there's already text in the box...
		if (module.textarea.textContent) {
			module.textarea.textContent += "\n\n";
		}
		module.textarea.textContent += tipString;
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
		var existingButton = e.currentTarget.parentNode.querySelector('.changetip-textarea-button'),
			username;
		if (!existingButton) {
			existingButton = module.attachButtonToTextarea(e.currentTarget);
		}
		if (module.doTipOnFocus) {
			module.doTipOnFocus = false;
			module.tipViaComment({
				target: existingButton
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

		username = $(textarea).closest('form').find('#message-recipient-username').val();

		tipButton = module.createTipButton(username);

		// save a reference to the textarea that we're attached to
		tipButton.textarea = textarea;

		// ensure this textarea's parent has position: relative or absolute so that
		// the tip button can be properly aligned. Fortunately, reddit has an empty
		// div around every textarea which serves perfectly as a container for us.
		parent.classList.add('changetip-enabled');

		var containerHeight = parseInt(window.getComputedStyle(parent).height),
			textareaHeight = parseInt(window.getComputedStyle(tipButton.textarea).height);

		tipButton.style.bottom = parseInt(containerHeight - textareaHeight + 5) + 'px';
		tipButton.style.marginLeft = window.getComputedStyle(tipButton.textarea).marginLeft;

		parent.appendChild(tipButton);

		return tipButton;
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

	module.createArticleTipButton = function(userid, username) {
		var tipButton = Utils.createElement('a', null, 'changetip-button changetip-tipme-button');
		tipButton.style.background = '#005197 url('+ChangeTip.sendImgURL+') no-repeat 2px 2px / 18px 18px';

		tipButton.textContent = 'Tip';
		tipButton.setAttribute('tabindex', '-1');
		// unfortunately we can't use a hash here because huddler will muck with it, so we have to use URL params.
		tipButton.setAttribute('href','/messages/messages/compose/u/' + userid + '?ChangeTip=true');
		tipButton.setAttribute('data-username', username);
		tipButton.setAttribute('title', 'send a tip to ' + username);

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
			type: 'iframe',
			x: pos.x,
			y: pos.y - 200,
			textarea: tipButton.textarea,
			amount: ChangeTip.getSetting('defaultAmount'),
			username: username
		});
		// we might call this outside of the context of a javascript event, so make sure...
		if (typeof e.preventDefault !== 'undefined') {
			e.preventDefault();
			e.stopPropagation();
		}
	};

});