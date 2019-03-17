const actionTypes = require('./actionTypes');

angular.module('inboxServices').factory('Actions',
  function(
    ContactViewModelGenerator,
    Selectors
  ) {
    'use strict';
    'ngInject';

    function createSingleValueAction(type, valueName, value) {
      const action = {
        type,
        payload: {}
      };
      action.payload[valueName] = value;
      return action;
    }

    return function(dispatch) {

      function createSetCancelCallbackAction(value) {
        return createSingleValueAction(actionTypes.SET_CANCEL_CALLBACK, 'cancelCallback', value);
      }

      function clearCancelCallback() {
        dispatch(createSetCancelCallbackAction(null));
      }

      function setCancelCallback(cancelCallback) {
        dispatch(createSetCancelCallbackAction(cancelCallback));
      }

      function createSetEnketoStatusAction(value) {
        return createSingleValueAction(actionTypes.SET_ENKETO_STATUS, 'enketoStatus', value);
      }

      function setEnketoError(error) {
        dispatch(createSetEnketoStatusAction({ error }));
      }

      function setEnketoEditedStatus(edited) {
        dispatch(createSetEnketoStatusAction({ edited }));
      }

      function setEnketoSavingStatus(saving) {
        dispatch(createSetEnketoStatusAction({ saving }));
      }

      function setSelectMode(selectMode) {
        dispatch(createSingleValueAction(actionTypes.SET_SELECT_MODE, 'selectMode', selectMode));
      }

      function setSelected(selected) {
        dispatch(createSingleValueAction(actionTypes.SET_SELECTED, 'selected', selected));
      }

      function updateSelected(selected) {
        dispatch(createSingleValueAction(actionTypes.UPDATE_SELECTED, 'selected', selected));
      }

      function updateSelectedItem(id, selected) {
        dispatch({
          type: actionTypes.UPDATE_SELECTED_ITEM,
          payload: { id, selected }
        });
      }

      function setFirstSelectedDocProperty(doc) {
        dispatch(createSingleValueAction(actionTypes.SET_FIRST_SELECTED_DOC_PROPERTY, 'doc', doc));
      }

      function setFirstSelectedFormattedProperty(formatted) {
        dispatch(createSingleValueAction(actionTypes.SET_FIRST_SELECTED_FORMATTED_PROPERTY, 'formatted', formatted));
      }

      function addSelectedMessage(message) {
        dispatch(createSingleValueAction(actionTypes.ADD_SELECTED_MESSAGE, 'message', message));
      }

      function removeSelectedMessage(id) {
        dispatch(createSingleValueAction(actionTypes.REMOVE_SELECTED_MESSAGE, 'id', id));
      }

      function addSelected(selected) {
        dispatch(createSingleValueAction(actionTypes.ADD_SELECTED, 'selected', selected));
      }

      function removeSelected(id) {
        dispatch(createSingleValueAction(actionTypes.REMOVE_SELECTED, 'id', id));
      }

      function setLoadingSelectedChildren(loading) {
        dispatch(createSingleValueAction(actionTypes.SET_LOADING_SELECTED_CHILDREN, 'loadingSelectedChildren', loading));
      }

      function setLoadingSelectedReports(loading) {
        dispatch(createSingleValueAction(actionTypes.SET_LOADING_SELECTED_REPORTS, 'loadingSelectedReports', loading));
      }

      function loadSelectedChildren(options) {
        return dispatch(function(dispatch, getState) {
          const selected = Selectors.getSelected(getState());
          return ContactViewModelGenerator.loadChildren(selected, options).then(children => {
            dispatch(createSingleValueAction(actionTypes.RECEIVE_SELECTED_CHILDREN, 'children', children));
          });
        });
      }

      function loadSelectedReports() {
        return dispatch(function(dispatch, getState) {
          const selected = Selectors.getSelected(getState());
          return ContactViewModelGenerator.loadReports(selected).then(reports => {
            dispatch(createSingleValueAction(actionTypes.RECEIVE_SELECTED_REPORTS, 'reports', reports));
          });
        });
      }

      function setLoadingContent(loading) {
        dispatch(createSingleValueAction('SET_LOADING_CONTENT', 'loadingContent', loading));
      }

      function setLoadingSubActionBar(loading) {
        dispatch(createSingleValueAction('SET_LOADING_SUB_ACTION_BAR', 'loadingSubActionBar', loading));
      }

      function setShowActionBar(showActionBar) {
        dispatch(createSingleValueAction('SET_SHOW_ACTION_BAR', 'showActionBar', showActionBar));
      }

      function setShowContent(showContent) {
        return dispatch(function(dispatch, getState) {
          const selectMode = Selectors.getSelectMode(getState());
          if (showContent && selectMode) {
            // when in select mode we never show the RHS on mobile
            return;
          }
          dispatch(createSingleValueAction('SET_SHOW_CONTENT', 'showContent', showContent));
        });
      }

      return {
        clearCancelCallback,
        setCancelCallback,
        setEnketoError,
        setEnketoEditedStatus,
        setEnketoSavingStatus,
        setSelectMode,
        setLoadingContent,
        setLoadingSubActionBar,
        setShowActionBar,
        setShowContent,
        // Global selected actions
        setSelected,
        updateSelected,
        // Contacts-specific selected actions
        setLoadingSelectedChildren,
        setLoadingSelectedReports,
        loadSelectedChildren,
        loadSelectedReports,
        // Messages-specific selected actions
        addSelectedMessage,
        removeSelectedMessage,
        // Reports-specific selected actions
        addSelected,
        removeSelected,
        updateSelectedItem,
        setFirstSelectedDocProperty,
        setFirstSelectedFormattedProperty
      };
    };
  }
);
