(function($) {
  /* define init variables for your organization */
  luminateExtend({
    apiKey: 'ahrt3', 
    path: {
      nonsecure: 'http://honor.americanheart.org/site/', 
      secure: 'https://secure2.convio.net/amha/site/'
    }
  });
  
  $(function() {
    
    /* UI handlers for the donation form example */
    if($('.donation-form').length > 0) {
      $('.donate-select label').click(function() {
        if($(this).next('div').is('.level-other-input')) {
			$('.level-other-input').slideDown();
          $('#other-amount-entered').removeAttr('disabled');
          $('#other-amount-entered').attr('name', 'other_amount_entered');
          $('#other-amount-entered').focus();
        }
        else {
			$('.level-other-input').slideUp();			
          $('#other-amount-entered').attr('disabled', 'disabled');
          $('#other-amount-entered').removeAttr('name');
        }
      });
      
      $('.donation-form').submit(function() {
		//move contact info details to billing info if any fields are blank
		$('[name^=billing\\.]').each(function(){
		  if ($(this).val() == ""){
			   $(this).val($("[name='"+$(this).attr("name").replace("billing.","donor.")+"']").val());
		  }
		});
		
		$('input[name=compliance]').val("true");
		
		if ($("input[name='donor.atpay_opt_in']").prop('checked')) {
			$("input[name='card_number']").attr('data-atpay', 'card_number');
			$("input[name='card_cvv']").attr('data-atpay', 'cvc');
			$("select[name='card_exp_date_month']").attr('data-atpay', 'exp_month');
			$("select[name='card_exp_date_year']").attr('data-atpay', 'exp_year');
			$("input[name='donor.email']").attr('data-atpay', 'email');
			
			if ($("input[name=billingchange]").prop('checked')) {
				$("input[name='billing.name.first']").attr('data-atpay', 'first_name');
				$("input[name='billing.name.last']").attr('data-atpay', 'last_name');
				$("input[name='billing.address.street1']").attr('data-atpay', 'street');
				$("input[name='billing.address.city']").attr('data-atpay', 'city');
				$("select[name='billing.address.state']").attr('data-atpay', 'state');
				$("input[name='billing.address.zip']").attr('data-atpay', 'zip');
				$("select[name='billing.address.country']").attr('data-atpay', 'country');
			} else {
				$("input[name='donor.name.first']").attr('data-atpay', 'first_name');
				$("input[name='donor.name.last']").attr('data-atpay', 'last_name');
				$("input[name='donor.address.street1']").attr('data-atpay', 'street');
				$("input[name='donor.address.city']").attr('data-atpay', 'city');
				$("select[name='donor.address.state']").attr('data-atpay', 'state');
				$("input[name='donor.address.zip']").attr('data-atpay', 'zip');
				$("select[name='donor.address.country']").attr('data-atpay', 'country');
			}
		}
		
        window.scrollTo(0, 0);
        $(this).hide();
        $(this).before('<div class="well donation-loading">' + 
                         'Thank You!  We are now processing your gift ...' + 
                       '</div>');
      });

	var form =$('form.donation-form');
	$(form).validate().settings.ignore = ":disabled,:hidden";
	
	$.validator.addMethod(
		"validDonation", 
		function(value, element) {
			element.value=element.value.replace("$","");
			value = element.value;
			if (value >= 10) {
				return true;
			} else {
				return false;
			}
		},
		"Please enter an amount $10 or greater"
	);

      $('#donate-submit').click(function() {
		if ($(form).valid()) {
			if ($('#PaymentType').val() == "cc") {
				$(form).submit();  
			} else {
				if (typeof amazon.Login.AmazonBillingAgreementId != "undefined") {
					if ($('label[for="type-monthly"] .active').length > 0) {				
						if (amazon.Login.MODBuyerBillingAgreementConsentStatus === "true") {
							donateAmazon();
						} else {
							alert("Consent is needed before making donation");
						}
					} else {
						donateAmazon();					
					}
				} else {
					alert("Please login to Amazon and select payment before submitting");
					return false;
				}
			}
		} else { 
			return false;
		}
      });
    }

	function donateAmazon() {
		window.scrollTo(0, 0);
		$('.donation-form').hide();
		$('.donation-form').before('<div class="well donation-loading">' + 
						 'Thank You!  We are now processing your donation using Amazon ...' + 
					   '</div>');
		var params = $('.donation-form').serialize();
		var amazonErr = false;
		var status = "";
		var amt = 0;
		var ref = 0;
		
		$.ajax({
			method: "POST",
			async: false,
			cache:false,
			dataType: "json",
			url:"https://hearttools.heart.org/donate/amazon/payWithAmazon.php?"+params+"&callback=?",
			success: function(data){
				if ($('label[for="type-monthly"] .active').length > 0) {
					status = data.data.AuthorizeOnBillingAgreementResult.AuthorizationDetails.AuthorizationStatus.State;
					amt = data.data.AuthorizeOnBillingAgreementResult.AuthorizationDetails.CapturedAmount.Amount;
					ref = data.data.AuthorizeOnBillingAgreementResult.AuthorizationDetails.AmazonAuthorizationId;
					
					if (status != "Closed") {
						amazonErr = true;
					}
				} else {
					status = data.data.AuthorizeResult.AuthorizationDetails.AuthorizationStatus.State;
					amt = data.data.AuthorizeResult.AuthorizationDetails.CapturedAmount.Amount;
					ref = data.data.AuthorizeResult.AuthorizationDetails.AmazonAuthorizationId;
					
					if (status != "Closed") {
						amazonErr = true;
					}
				}

				if (amazonErr) {
					$('#donation-errors').append('<div class="alert alert-danger">' + data.data.toString() + '</div>');	
			
					$('.donation-loading').remove();
					$('.donation-form').show();				
				} else {
					//save off amazon id into custom field
					$('input[name=payment_confirmation_id]').val(ref);
					
					//logout of amazon
					amazon.Login.logout();
					
					//make offline donation in luminate to record transaction
					if ($('input[name="df_preview"]').val() != "true") donateOffline();
					
					//var amt = data.donationResponse.donation.amount.decimal;
					var email = $('input[name="donor.email"]').val();
					var first = $('input[name="donor.name.first"]').val();
					var last = $('input[name="donor.name.last"]').val();
					var full = $('input[name="donor.name.first"]').val()+' '+$('input[name="donor.name.last"]').val();
					var street1 = $('input[name="donor.address.street1"]').val();
					var street2 = $('input[name="donor.address.street2"]').val();
					var city = $('input[name="donor.address.city"]').val();
					var state = $('select[name="donor.address.state"]').val();
					var zip = $('input[name="donor.address.zip"]').val();
					var country = $('select[name="donor.address.country"]').val();
					//var ref = data.donationResponse.donation.confirmation_code;
					var cdate = $('select[name="card_exp_date_month"]').val() + "/" + $('select[name="card_exp_date_year"]').val();
					var cc=$('input[name=card_number]').val();
					var ctype = $('input[name=card_number]').attr("class").replace(" valid","").toUpperCase();	
					
				  $('.donation-loading').remove();
				  $('.donate-now, .header-donate').hide();
				  $('.thank-you').show();
				  $.get("thankyou.html?v=2",function(datat){ 
					  $('.thank-you').html($(datat).find('.thank-you').html());
					  $('p.first').html(first);
					  $('p.last').html(last);
					  $('p.street1').html(street1);
					  $('p.street2').html(street2);
					  $('p.city').html(city);
					  $('p.state').html(state);
					  $('p.zip').html(zip);
					  $('p.country').html(country);
					  $('p.email').html(email);
					  $('tr.cardGroup').hide();
					  $('tr.amazon').show();
					  $('p.amount').html("$"+amt);
					  $('p.confcode').html(ref);
					  
					});
							  
					var postdata='form=heartchallenge&siftsess='+$('input[name=_session]').val()+'&';
					postdata+="&cc="+cc.substr(cc.length-4,4);
					
					postdata+="&amount="+amt;
					postdata+="&email_address="+email;
					postdata+="&first_name="+first;
					postdata+="&last_name="+last;
					postdata+="&billing_name="+full;
					
					postdata+="&address_line_1="+street1;
					postdata+="&address_line_2="+street2;
					postdata+="&city="+city;
					postdata+="&state="+state;
					postdata+="&zip="+zip;
					postdata+="&country="+country;
					postdata+="&ref="+ref;
		
					$.getJSON("https://hearttools.heart.org/siftscience/postSSData.php?"+postdata+"&callback=?");		

					$('.thank-you').append('<img src="http://www.offeredby.net/silver/track/rvm.cfm?cid=28556&oid='+ref+'&amount='+amt+'&quantity=1" height="1" width="1">');
					$.getScript("//action.dstillery.com/orbserv/nsjs?adv=cl1014039&ns=1985&nc=HBP-Donate-Now-Landing-Page&ncv=52&dstOrderId="+ref+"&dstOrderAmount="+amt);
								
					/* ECOMMERCE TRACKING CODE */ 
					ga('require', 'ecommerce');
		
					ga('ecommerce:addTransaction', {
					  'id': ref,
					  'affiliation': 'AHA Amazon Donation '+khctitle,
					  'revenue': amt,
					  'city': $('input[name="donor.address.city"]').val(),
					  'state': $('select[name="donor.address.state"]').val()  // local currency code.
					});
		
					ga('ecommerce:send');
					
					ga('send', 'pageview', '/donateok.asp');
					/*
					_gaq.push(['_addTrans',
						ref,           // transaction ID - required
						'AHA Amazon Donation ',  // affiliation or store name
						amt,      // total - required
						$('input[name="donor.address.city"]').val(),      // city
						$('select[name="donor.address.state"]').val()     // state or province
					]);
					
					_gaq.push(['_trackTrans']); //submits transaction to the Analytics servers
					*/
				}
			}
		});

	}

	function donateOffline() {
		var params = $('.donation-form').serialize();

		$.ajax({
			method: "POST",
			async: false,
			cache:false,
			dataType: "json",
			url:"https://hearttools.heart.org/donate/convio-offline/addOfflineDonation.php?"+params+"&callback=?",
			success: function(data){
				//donateCallback.success(data.data);
			}
		});

	}
    
    /* example: handle the donation form submission */
    /* if the donation is successful, display a thank you message */
    /* if there is an error with the donation, display it inline */
    window.donateCallback = {
      error: function(data) {
        $('#donation-errors').remove();

        $('.donation-form').prepend('<div id="donation-errors">' + 
                                      '<div class="alert alert-danger">' + 
                                        data.errorResponse.message + 
                                      '</div>' + 
                                    '</div>');

        $('.donation-loading').remove();
        $('.donation-form').show();
      }, 
      success: function(data) {
        $('#donation-errors').remove();
        
        if(data.donationResponse.errors) {
          $('.donation-form').prepend('<div id="donation-errors">' + 
                                        ((data.donationResponse.errors.message) ? ('<div class="alert alert-danger">' + 
                                          data.donationResponse.errors.message + 
                                        '</div>') : '') + 
                                      '</div>');

		if (data.donationResponse.errors.declineDetail) {
	        $('#donation-errors').append('<div class="alert alert-danger">' + 
    	                                    data.donationResponse.errors.declineDetail + 
	                                      '</div>');	
		}

		if (data.donationResponse.errors.declineUserMessage) {
	        $('#donation-errors').append('<div class="alert alert-danger">' + 
    	                                    data.donationResponse.errors.declineUserMessage + 
	                                      '</div>');	
		}

          if(data.donationResponse.errors.fieldError) {
            var fieldErrors = luminateExtend.utils.ensureArray(data.donationResponse.errors.fieldError);
            $.each(fieldErrors, function() {
              $('#donation-errors').append('<div class="alert alert-danger">' + 
                                             this + 
                                           '</div>');
            });
          }
          
          $('.donation-loading').remove();
          $('.donation-form').show();
        }
        else {
			var amt = data.donationResponse.donation.amount.decimal;
			var email = $('input[name="donor.email"]').val();
			var first = $('input[name="billing.name.first"]').val();
			var last = $('input[name="billing.name.last"]').val();
			var full = $('input[name="billing.name.first"]').val()+' '+$('input[name="billing.name.last"]').val();
			var street1 = $('input[name="billing.address.street1"]').val();
			var street2 = $('input[name="billing.address.street2"]').val();
			var city = $('input[name="billing.address.city"]').val();
			var state = $('select[name="billing.address.state"]').val();
			var zip = $('input[name="billing.address.zip"]').val();
			var ref = data.donationResponse.donation.confirmation_code;
			var cdate = $('select[name="card_exp_date_month"]').val() + "/" + $('select[name="card_exp_date_year"]').val();
			var cc=$('input[name=card_number]').val();
			var ctype = $('input[name=card_number]').attr("class").replace(" valid","").toUpperCase();	
			var form=$('input[name=form_id]').val();


			if ($('input[name=occurrenc]:checked').val() == 'Monthly Gift') {
				var freq = 'monthly';
			} else {
				var freq = 'one time';
			}
					
          $('.donation-loading').remove();
		  $('.donate-now').hide();
		  $('.thank-you').show();
		  $.get("thankyou.html",function(datat){
			  if (form == "3343") {
				  datat = datat.replace("FIRST_NAME",first);
				  datat = datat.replace("LAST_NAME",last);				  
				  datat = datat.replace("EMAIL_ADDRESS",email);
				  datat = datat.replace("AMOUNT",amt);
				  datat = datat.replace("TRANSID",ref);
			  }
			  $('.thank-you').html($(datat).find('.thank-you').html());
	          /*
			  $('.confirmationText').html('<div class="alert alert-success">' + 
                                       'Your donation has been processed!' + 
                                     '</div>' + 
                                     '<div class="well">' + 
                                       '<p>Thank you for your donation of $' + data.donationResponse.donation.amount.decimal + '.</p>' + 
                                       '<p>Your confirmation code is ' + data.donationResponse.donation.confirmation_code + '.</p>' + 
                                     '</div>');
			  */
			  $('p.first').html(first);
			  $('p.last').html(last);
			  $('p.street1').html(street1);
  			  $('p.street2').html(street2);
			  $('p.city').html(city);
			  $('p.state').html(state);
			  $('p.zip').html(zip);
			  $('p.email').html(email);
			  $('p.cardtype').html(ctype);
			  $('p.cardnumber').html(cc.substr(cc.length-4,4));
			  $('p.carddate').html(cdate);
			  $('p.amount').html("$"+data.donationResponse.donation.amount.decimal);
			  $('p.confcode').html(ref);
			});

			$('.thank-you').append('<img src="//www.offeredby.net/silver/track/rvm.cfm?cid=28556&oid='+ref+'&amount='+amt+'&quantity=1" height="1" width="1">');
			$.getScript("//action.dstillery.com/orbserv/nsjs?adv=cl1014039&ns=1985&nc=HBP-Donate-Now-Landing-Page&ncv=52&dstOrderId="+ref+"&dstOrderAmount="+amt);

			var postdata='form=heartconvio&siftsess='+$('input[name=_session]').val()+'&';
			postdata+="&cc="+cc.substr(cc.length-4,4);
			
			postdata+="&amount="+data.donationResponse.donation.amount.decimal;
			postdata+="&email_address="+email;
			postdata+="&first_name="+first;
			postdata+="&last_name="+last;
			postdata+="&billing_name="+full;
			
			postdata+="&address_line_1="+street1;
			postdata+="&address_line_2="+street2;
			postdata+="&city="+city;
			postdata+="&state="+state;
			postdata+="&zip="+zip;
			postdata+="&ref="+ref;

			$.getJSON("https://hearttools.heart.org/siftscience/postSSData.php?"+postdata+"&callback=?");		
			
			/* ECOMMERCE TRACKING CODE */ 
			ga('require', 'ecommerce');

			ga('ecommerce:addTransaction', {
			  'id': ref,
			  'affiliation': 'Heart Form',
			  'revenue': amt,
			  'city': $('input[name="donor.address.city"]').val(),
			  'state': $('select[name="donor.address.state"]').val()  // local currency code.
			});

			ga('ecommerce:send');
			/*
			_gaq.push(['_addTrans',
				ref,           // transaction ID - required
				'AHA CC Donation ',  // affiliation or store name
				amt,      // total - required
				$('input[name="donor.address.city"]').val(),      // city
				$('select[name="donor.address.state"]').val()     // state or province
			]);
			
			_gaq.push(['_trackTrans']); //submits transaction to the Analytics servers
			*/
			
			atpay.register(".donation-form",function(response){});
			/* CHIRAG CHHITA ADD GOOGLE TRACKING PIXEL TO THANK YOU PAGE */
			var google_conversion_id = 936930558;
			var google_conversion_language = "en";
			var google_conversion_format = "3";
			var google_conversion_color = "ffffff";
			var google_conversion_label = "HZKtCMmH2WIQ_tnhvgM";
			var google_remarketing_only = false;
			$.getScript("//www.googleadservices.com/pagead/conversion.js");

			/* END TRACKING PIXEL CODE */
			
        }
      }
    };
    
    /* bind any forms with the "luminateApi" class */
    luminateExtend.api.bind();
  });
})(jQuery);

function getAmazonAddress() {
	var params = $('.donation-form').serialize();
	$.ajax({
		method: "POST",
		async: false,
		cache:false,
		dataType: "json",
		url:"https://hearttools.heart.org/donate/amazon/getAmazonAddress.php?"+params+"&callback=?",
		success: function(data){
			var address = data.data.GetBillingAgreementDetailsResult.BillingAgreementDetails.BillingAddress.PhysicalAddress;
			$('input[name="donor.address.street1"]').val(address.AddressLine1);
			$('input[name="donor.address.city"]').val(address.City);
			$('select[name="donor.address.state"]').val(address.StateOrRegion);
			$('input[name="donor.address.zip"]').val(address.PostalCode);			
			$('input[name="billing.address.street1"]').val(address.AddressLine1);
			$('input[name="billing.address.city"]').val(address.City);
			$('select[name="billing.address.state"]').val(address.StateOrRegion);
			$('input[name="billing.address.zip"]').val(address.PostalCode);			
		}
	});
}

(function ($) {
	$.extend({
		getQuerystring: function(name){
		  name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
		  var regexS = "[\\?&]" + name + "=([^&#]*)";
		  var regex = new RegExp(regexS);
		  var results = regex.exec(location.href);
		  if(results == null)
			return "";
		  else
			return decodeURIComponent(results[1].replace(/\+/g, " "));
		}
	});
})(jQuery);

jQuery(document).ready( function($) {
 
    // Disable scroll when focused on a number input.
    $('form').on('focus', 'input[type=number]', function(e) {
        $(this).on('wheel', function(e) {
            e.preventDefault();
        });
    });
 
    // Restore scroll on number inputs.
    $('form').on('blur', 'input[type=number]', function(e) {
        $(this).off('wheel');
    });
 
    // Disable up and down keys.
    $('form').on('keydown', 'input[type=number]', function(e) {
        if ( e.which == 38 || e.which == 40 )
            e.preventDefault();
    });  
	$('form').on('blur', '#cardNumber', function(){
		this.value = this.value.replace(/ /g, '');
	});

});

$("#cardNumber").validateCreditCard(function(e) {
	return $("#cardNumber").removeClass(), null == e.card_type ? void $(".vertical.maestro").slideUp({
		duration: 200
	}).animate({
		opacity: 0
	}, {
		queue: !1,
		duration: 200
	}) : ($("#cardNumber").addClass(e.card_type.name), "maestro" === e.card_type.name ? $(".vertical.maestro").slideDown({
		duration: 200
	}).animate({
		opacity: 1
	}, {
		queue: !1
	}) : $(".vertical.maestro").slideUp({
		duration: 200
	}).animate({
		opacity: 0
	}, {
		queue: !1,
		duration: 200
	}), e.length_valid && e.luhn_valid ? $("#cardNumber").addClass("valid") : $("#cardNumber").removeClass("valid"))
}, {
	accept: ["visa", "mastercard", "amex", "discover"]
});

//copy donor fields to billing
$('[name^=donor\\.]').each(function(){
  $(this).blur(function(){
    $("[name='"+$(this).attr("name").replace("donor.","billing.")+"']").val($(this).val());
  });
});

// ADD QUERY STRING CODE
	
	//autofill from querystring data
	$('input[name="donor.name.first"]').val($.getQuerystring("first"));
	$('input[name="donor.name.last"]').val($.getQuerystring("last"));
	$('input[name="donor.address.street1"]').val($.getQuerystring("street1"));	
	$('input[name="donor.address.street2"]').val($.getQuerystring("street2"));	
	$('input[name="donor.address.city"]').val($.getQuerystring("city"));	
	$('select[name="donor.address.state"]').val($.getQuerystring("state"));	
	$('input[name="donor.address.zip"]').val($.getQuerystring("zip"));	
	$('input[name="donor.email"]').val($.getQuerystring("email"));	

	$('.group1').show();
	$('.group2').hide();
	if($.getQuerystring("group") == "0") {
		$('.group1').hide();
		$('.group2').show();
	}	      

// END QUERY STRING CODE 
      // This example displays an address form, using the autocomplete feature
      // of the Google Places API to help users fill in the information.

      // This example requires the Places library. Include the libraries=places
      // parameter when you first load the API. For example:
      // <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places">

      var placeSearch, autocomplete;
      var componentForm = {
        street_number: 'short_name',
        route: 'long_name',
        locality: 'short_name',
        administrative_area_level_1: 'short_name',
        country: 'long_name',
        postal_code: 'short_name'
      };

      function initAutocomplete() {
        // Create the autocomplete object, restricting the search to geographical
        // location types.
        autocomplete = new google.maps.places.Autocomplete(
            /** @type {!HTMLInputElement} */(document.getElementById('geocomplete')),
            {types: ['geocode']});

        // When the user selects an address from the dropdown, populate the address
        // fields in the form.
        autocomplete.addListener('place_changed', fillInAddress);
		$('#geocomplete').removeAttr("disabled");
      }

      function fillInAddress() {
        // Get the place details from the autocomplete object.
        var place = autocomplete.getPlace();
        for (var component in componentForm) {
          $(component).val('');
          $(component).removeAttr("disabled");
        }

        // Get each component of the address from the place details
        // and fill the corresponding field on the form.
		var val = place.name;
		$('.name').val(val);

        for (var i = 0; i < place.address_components.length; i++) {
          var addressType = place.address_components[i].types[0];
		  if (componentForm[addressType]) {
			var val = place.address_components[i][componentForm[addressType]];
			$('.'+addressType).val(val);
		  }
        }
		
		$('.contact-address').slideDown();
      }

      // Bias the autocomplete object to the user's geographical location,
      // as supplied by the browser's 'navigator.geolocation' object.
      function geolocate() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(position) {
            var geolocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            var circle = new google.maps.Circle({
              center: geolocation,
              radius: position.coords.accuracy
            });
            autocomplete.setBounds(circle.getBounds());
          });
        }
      }

    $('.toggleTribute').change(function() {
		if ($(this).is(':checked')) {
			$('.tribute').slideDown();
		} else {
			$('.tribute').slideUp();
		}
	});
	
	//check for any passed parameters
																											 
	if ($.getQuerystring("s_src")) {
		$('input[name=source]').val($.getQuerystring("s_src"));
	}
		
	if ($.getQuerystring("level_id")) {
		$('input[name=level_id][value='+$.getQuerystring("level_id")+']').attr("checked","checked");
	}

// ADD QUERY STRING CODE 
	if ($.getQuerystring("honor") == "true") {
		$(document).ready(function(){
			$('.tribute-select .icon-selection:eq(1) label').click();
			if ($.getQuerystring("trib_fname")) {
				$('input[name="tribute.honoree.name.first"]').val($.getQuerystring("trib_fname"));
			}
			if ($.getQuerystring("trib_lname")) {
				$('input[name="tribute.honoree.name.last"]').val($.getQuerystring("trib_lname"));
			}
		});
	}
	if ($.getQuerystring("memorial") == "true") { 
		$(document).ready(function(){
			$('.tribute-select .icon-selection:eq(2) label').click();
			if ($.getQuerystring("trib_fname")) {
				$('input[name="tribute.honoree.name.first"]').val($.getQuerystring("trib_fname"));
			}
			if ($.getQuerystring("trib_lname")) {
				$('input[name="tribute.honoree.name.last"]').val($.getQuerystring("trib_lname"));
			}
		});
	}
	if ($.getQuerystring("msource")) {
		$('input[name=source]').val($.getQuerystring("msource"));
	}
// END QUERY STRING CODE 
		
	if ($.getQuerystring("amount")) {
		//$('label.active').removeClass("active");
		//$('label.level_other').addClass("active");
		$('.level-other-input').slideDown();
        $('#other-amount-entered').removeAttr('disabled');
        $('#other-amount-entered').attr('name', 'other_amount_entered');
		$('input[name=other_amount]').val($.getQuerystring("amount"));
		$('input[name=other_amount_entered]').val($.getQuerystring("amount"));
	}
		
	var tmpDate = new Date().getTime();
	var _user_id = ''; // IMPORTANT! Set to the user's ID, username, or email address, or '' if not yet known.
	var _session_id = 's'+tmpDate; // Set to a unique session ID for the visitor's current browsing session.
	$('input[name=_session]').val(_session_id);
	
	var _sift = _sift || [];
	_sift.push(['_setAccount', 'fc4ebfb07e']);
	_sift.push(['_setUserId', _user_id]);
	_sift.push(['_setSessionId', _session_id]);
	_sift.push(['_trackPageview']);
	(function() {
		function ls() {
		  var e = document.createElement('script');
		  e.type = 'text/javascript';
		  e.async = true;
		  e.src = ('https:' == document.location.protocol ? 'https://' : 'http://') + 'cdn.siftscience.com/s.js';
		  var s = document.getElementsByTagName('script')[0];
		  s.parentNode.insertBefore(e, s);
		}
		if (window.attachEvent) {
		  window.attachEvent('onload', ls);
		} else {
		  window.addEventListener('load', ls, false);
		}
	})();