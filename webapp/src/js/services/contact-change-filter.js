/**
 * Service to identify relevant changes in relation to a Contact document.
 */
var _ = require('underscore');

angular.module('inboxServices').factory('ContactChangeFilter',
  function(ContactTypes) {
    'ngInject';
    'use strict';

    var isValidInput = function(object) {
      return !!(object && object.doc);
    };

    var isReport = function(change) {
      return !!change.doc.form && change.doc.type === 'data_record';
    };

    var matchReportSubject = function(report, contact) {
      if (report.doc.fields && (
          (report.doc.fields.patient_id && report.doc.fields.patient_id === contact.doc._id) ||
          (report.doc.fields.patient_id && report.doc.fields.patient_id === contact.doc.patient_id) ||
          (report.doc.fields.place_id && report.doc.fields.place_id === contact.doc._id) ||
          (report.doc.fields.place_id && report.doc.fields.place_id === contact.doc.place_id))) {
        return true;
      }

      if ((report.doc.patient_id && report.doc.patient_id === contact.doc.patient_id) ||
          (report.doc.patient_id && report.doc.patient_id === contact.doc._id) ||
          (report.doc.place_id && report.doc.place_id === contact.doc.place_id) ||
          (report.doc.place_id && report.doc.place_id === contact.doc._id)) {
        return true;
      }

      return false;
    };

    var isChild = function(change, contact) {
      return !!change.doc.parent && change.doc.parent._id === contact.doc._id;
    };

    var wasChild = function(change, contact) {
      return _.some(contact.children, function(children) {
        return children instanceof Array && _.some(children, function(child) {
          return child.doc._id === change.doc._id;
        });
      });
    };

    var isAncestor = function(change, contact) {
     return _.some(contact.lineage, function(lineage) {
        return !!lineage && lineage._id === change.doc._id;
      });
    };

    var matchChildReportSubject = function(change, contact) {
      return _.some(contact.children, function(children) {
        return children instanceof Array && _.some(children, function(child) {
          return matchReportSubject(change, child);
        });
      });
    };

    return {
      matchContact: function(change, contact) {
        return isValidInput(contact) &&
               contact.doc._id === change.id;
      },
      isRelevantReport: function(change, contact) {
        return isValidInput(change) &&
               isValidInput(contact) &&
               isReport(change) &&
               (matchReportSubject(change, contact) || matchChildReportSubject(change, contact));
      },
      isRelevantContact: function(change, contact) {
        return isValidInput(change) &&
               isValidInput(contact) &&
               ContactTypes.includes(change.doc) &&
               (isAncestor(change, contact) || isChild(change, contact) || wasChild(change, contact));
      },
      isDeleted: function(change) {
        return !!change && !!change.deleted;
      }
    };
  }
);
