angular.module('inboxControllers').controller('ContactsEditCtrl',
  function (
    $log,
    $ngRedux,
    $q,
    $scope,
    $state,
    $timeout,
    $translate,
    ContactForm,
    ContactSave,
    ContactSchema,
    Enketo,
    GlobalActions,
    LineageModelGenerator,
    Selectors,
    Snackbar
  ) {

    'use strict';
    'ngInject';

    const ctrl = this;
    const mapStateToTarget = function(state) {
      return {
        enketoStatus: Selectors.getEnketoStatus(state),
        enketoSaving: Selectors.getEnketoSavingStatus(state),
        loadingContent: Selectors.getLoadingContent(state)
      };
    };
    const mapDispatchToTarget = function(dispatch) {
      const globalActions = GlobalActions(dispatch);
      return {
        setCancelCallback: globalActions.setCancelCallback,
        setEnketoEditedStatus: globalActions.setEnketoEditedStatus,
        setEnketoSavingStatus: globalActions.setEnketoSavingStatus,
        setEnketoError: globalActions.setEnketoError,
        setLoadingContent: globalActions.setLoadingContent,
        setShowContent: globalActions.setShowContent,
        setTitle: globalActions.setTitle
      };
    };
    const unsubscribe = $ngRedux.connect(mapStateToTarget, mapDispatchToTarget)(ctrl);

    ctrl.setLoadingContent(true);
    ctrl.setShowContent(true);
    ctrl.setCancelCallback(function() {
      if ($state.params.from === 'list') {
        $state.go('contacts.detail', { id: null });
      } else {
        $state.go('contacts.detail', { id: $state.params.id || $state.params.parent_id });
      }
    });

    var setTitle = function() {
      var key = '';
      if (ctrl.category === 'person') {
        if (ctrl.contactId) {
          key = 'contact.type.person.edit';
        } else {
          key = 'contact.type.person.new';
        }
      } else {
        if (ctrl.contactId) {
          key = 'contact.type.place.edit';
        } else {
          key = 'contact.type.place.new';
        }
      }
      $translate.onReady().then(function() {
        return $translate(key);
      }).then(ctrl.setTitle);
    };

    var getFormInstanceData = function() {
      if (!ctrl.contact || !ctrl.contact.type) {
        return null;
      }
      var result = {};
      result[ctrl.contact.type] = ctrl.contact;
      return result;
    };

    var getContact = function() {
      var id = $state.params.id;
      if (!id) {
        return $q.resolve();
      }
      return LineageModelGenerator.contact(id, { merge: true })
        .then(function(result) {
          return result.doc;
        });
    };

    var getCategory = function(type) {
      return type === 'person' ? 'person' : 'place';
    };

    var getForm = function(contact) {
      if (contact) {
        ctrl.contact = contact;
        ctrl.contactId = contact._id;
        ctrl.category = getCategory(contact.type);
        setTitle();
        return ContactForm.forEdit(contact.type, { contact: ctrl.dependentPersonSchema });
      }

      ctrl.contact = {
        type: $state.params.type,
        parent: $state.params.parent_id
      };

      ctrl.category = getCategory(ctrl.contact.type);
      ctrl.contactId = null;
      setTitle();

      if (ctrl.contact.type) {
        var extras = ctrl.contact.type === 'person' ? null : { contact: ctrl.dependentPersonSchema };
        return ContactForm.forCreate(ctrl.contact.type, extras);
      }
      return $q.resolve();
    };

    var markFormEdited = function() {
      ctrl.setEnketoEditedStatus(true);
    };

    var renderForm = function(form) {
      return $timeout(function() {
        var container = $('#contact-form');
        if (!form) {
          // Disable next and prev buttons
          container.find('.form-footer .btn')
              .filter('.previous-page, .next-page')
              .addClass('disabled');
          return;
        }
        ctrl.setEnketoEditedStatus(false);
        var instanceData = getFormInstanceData();
        if (form.id) {
          return Enketo.renderContactForm('#contact-form', form.id, instanceData, markFormEdited);
        }
        return Enketo.renderFromXmlString('#contact-form', form.xml, instanceData, markFormEdited);
      });
    };

    var setEnketoContact = function(formInstance) {
      ctrl.enketoContact = {
        type: ctrl.contact.type,
        formInstance: formInstance,
        docId: ctrl.contactId,
      };
    };

    ctrl.unmodifiedSchema = ContactSchema.get();
    ctrl.dependentPersonSchema = ContactSchema.get('person');
    delete ctrl.dependentPersonSchema.fields.parent;

    getContact()
      .then(function(contact) {
        if (!contact) {
          // adding a new contact, deselect the old one
          $scope.clearSelected();
          $scope.settingSelected();
        }

        return contact;
      })
      .then(getForm)
      .then(renderForm)
      .then(setEnketoContact)
      .then(function() {
        ctrl.setLoadingContent(false);
      })
      .catch(function(err) {
        ctrl.errorTranslationKey = err.translationKey || 'error.loading.form';
        ctrl.setLoadingContent(false);
        ctrl.contentError = true;
        $log.error('Error loading contact form.', err);
      });

    ctrl.save = function() {
      if (ctrl.enketoSaving) {
        $log.debug('Attempted to call contacts-edit:$scope.save more than once');
        return;
      }

      var form = ctrl.enketoContact.formInstance;
      var docId = ctrl.enketoContact.docId;
      ctrl.setEnketoSavingStatus(true);
      ctrl.setEnketoError(null);

      return form.validate()
        .then(function(valid) {
          if(!valid) {
            throw new Error('Validation failed.');
          }

          var type = ctrl.enketoContact.type;
          return ContactSave(ctrl.unmodifiedSchema[type], form, docId, type)
            .then(function(result) {
              $log.debug('saved report', result);
              ctrl.setEnketoSavingStatus(false);
              $translate(docId ? 'contact.updated' : 'contact.created').then(Snackbar);
              ctrl.setEnketoEditedStatus(false);
              $state.go('contacts.detail', { id: result.docId });
            })
            .catch(function(err) {
              ctrl.setEnketoSavingStatus(false);
              $log.error('Error submitting form data', err);
              $translate('Error updating contact').then(function(msg) {
                ctrl.setEnketoError(msg);
              });
            });
        })
        .catch(function() {
          // validation messages will be displayed for individual fields.
          // That's all we want, really.
          ctrl.setEnketoSavingStatus(false);
          $scope.$apply();
        });
    };

    $scope.$on('$destroy', function() {
      unsubscribe();
      if (!$state.includes('contacts.add')) {
        ctrl.setTitle();
        if (ctrl.enketoContact && ctrl.enketoContact.formInstance) {
          Enketo.unload(ctrl.enketoContact.formInstance);
        }
      }
    });

  }
);
