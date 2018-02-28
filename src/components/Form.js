import React, { Component } from "react";
import PropTypes from "prop-types";

import { default as DefaultErrorList } from "./ErrorList";
import { default as LoadingMessage } from "./LoadingMessage";
import {
  getDefaultFormState,
  getDefaultRegistry,
  isPromise,
  retrieveSchema,
  setState,
  shouldRender,
  toIdSchema,
} from "../utils";
import validateFormData, { toErrorList } from "../validate";

export default class Form extends Component {
  static defaultProps = {
    uiSchema: {},
    noValidate: false,
    liveValidate: false,
    safeRenderCompletion: false,
    noHtml5Validate: false,
    ErrorList: DefaultErrorList,
    renderValidatingMessage: true,
  };

  constructor(props) {
    super(props);
    this.state = this.unpackValidationResult(this.getStateFromProps(props));
  }

  componentWillReceiveProps(nextProps) {
    this.setState(
      this.unpackValidationResult(this.getStateFromProps(nextProps))
    );
  }

  unpackValidationResult(stateObj) {
    // Unpack the validationResult from a state object as appropriate: If it's
    // wrapped in a promise, then add a callback to setState once the promise
    // resolves, otherwise just unpack the object.
    let { validationResult, ...state } = stateObj;

    if (!isPromise(validationResult)) {
      state = { ...validationResult, ...state };
      return state;
    }

    state = { waitingForValidation: true, ...state };
    validationResult.then(errorObj => {
      // Something beat us to updating the state, so don't change it now
      if (this.props !== this.originalProps) {
        return;
      }
      this.setState({ waitingForValidation: false, ...errorObj });
    });
    return state;
  }

  getStateFromProps(props) {
    const state = this.state || {};
    const schema = "schema" in props ? props.schema : this.props.schema;
    const uiSchema = "uiSchema" in props ? props.uiSchema : this.props.uiSchema;
    const edit = typeof props.formData !== "undefined";
    const liveValidate = props.liveValidate || this.props.liveValidate;
    const mustValidate = edit && !props.noValidate && liveValidate;
    const { definitions } = schema;
    const formData = getDefaultFormState(schema, props.formData, definitions);
    const retrievedSchema = retrieveSchema(schema, definitions, formData);

    // Maintain a reference to the current props to mitigate races
    this.originalProps = props;
    const validationResult = mustValidate
      ? this.validate(formData, schema)
      : {
          errors: state.errors || [],
          errorSchema: state.errorSchema || {},
        };

    const idSchema = toIdSchema(
      retrievedSchema,
      uiSchema["ui:rootFieldId"],
      definitions,
      formData,
      props.idPrefix
    );

    return {
      schema,
      uiSchema,
      idSchema,
      formData,
      edit,
      validationResult,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shouldRender(this, nextProps, nextState);
  }

  validate(formData, schema) {
    const { validate, transformErrors } = this.props;
    return validateFormData(
      formData,
      schema || this.props.schema,
      validate,
      transformErrors
    );
  }

  renderErrors() {
    if (this.state.waitingForValidation) {
      return null;
    }
    const { errors, errorSchema, schema, uiSchema } = this.state;
    const { ErrorList, showErrorList, formContext } = this.props;

    if (errors.length && showErrorList != false) {
      return (
        <ErrorList
          errors={errors}
          errorSchema={errorSchema}
          schema={schema}
          uiSchema={uiSchema}
          formContext={formContext}
        />
      );
    }
    return null;
  }

  renderValidatingIndicator() {
    if (!this.props.renderValidatingMessage) {
      return null;
    }

    return (
      <LoadingMessage
        show={this.state.waitingForValidation}
        message="Validating..."
      />
    );
  }

  onChange = (formData, newErrorSchema) => {
    const handleValidationResult = result => {
      return setState(this, { ...state, ...result }, () => {
        if (this.props.onChange) {
          this.props.onChange(this.state);
        }
      });
    };

    const mustValidate = !this.props.noValidate && this.props.liveValidate;
    let state = { formData };
    let validationResult;
    if (mustValidate) {
      validationResult = this.validate(formData);
    } else if (!this.props.noValidate && newErrorSchema) {
      validationResult = {
        errorSchema: newErrorSchema,
        errors: toErrorList(newErrorSchema),
      };
    }

    if (isPromise(validationResult)) {
      validationResult.then(vr => handleValidationResult(vr));
      return;
    }
    handleValidationResult(validationResult);
  };

  onBlur = (...args) => {
    if (this.props.onBlur) {
      this.props.onBlur(...args);
    }
  };

  onFocus = (...args) => {
    if (this.props.onFocus) {
      this.props.onFocus(...args);
    }
  };

  onSubmit = event => {
    event.preventDefault();
    const handleValidationResult = ({ errors, errorSchema }) => {
      if (Object.keys(errors).length > 0) {
        setState(this, { errors, errorSchema }, () => {
          if (this.props.onError) {
            this.props.onError(errors);
          } else {
            console.error("Form validation failed", errors);
          }
        });
        return;
      }
      if (this.props.onSubmit) {
        this.props.onSubmit({ ...this.state, status: "submitted" });
      }
      this.setState({ errors: [], errorSchema: {} });
    };

    if (!this.props.noValidate) {
      let validationResult = this.validate(this.state.formData);
      if (isPromise(validationResult)) {
        validationResult.then(x => handleValidationResult(x));
      } else {
        handleValidationResult(validationResult);
      }
    }
  };

  getRegistry() {
    // For BC, accept passed SchemaField and TitleField props and pass them to
    // the "fields" registry one.
    const { fields, widgets } = getDefaultRegistry();
    return {
      fields: { ...fields, ...this.props.fields },
      widgets: { ...widgets, ...this.props.widgets },
      ArrayFieldTemplate: this.props.ArrayFieldTemplate,
      ObjectFieldTemplate: this.props.ObjectFieldTemplate,
      FieldTemplate: this.props.FieldTemplate,
      definitions: this.props.schema.definitions || {},
      formContext: this.props.formContext || {},
    };
  }

  render() {
    const {
      children,
      safeRenderCompletion,
      id,
      className,
      name,
      method,
      target,
      action,
      autocomplete,
      enctype,
      acceptcharset,
      noHtml5Validate,
    } = this.props;

    const { schema, uiSchema, formData, errorSchema, idSchema } = this.state;
    const registry = this.getRegistry();
    const _SchemaField = registry.fields.SchemaField;

    return (
      <form
        className={className ? className : "rjsf"}
        id={id}
        name={name}
        method={method}
        target={target}
        action={action}
        autoComplete={autocomplete}
        encType={enctype}
        acceptCharset={acceptcharset}
        noValidate={noHtml5Validate}
        onSubmit={this.onSubmit}>
        {this.renderErrors()}
        {this.renderValidatingIndicator()}
        <_SchemaField
          schema={schema}
          uiSchema={uiSchema}
          errorSchema={errorSchema}
          idSchema={idSchema}
          formData={formData}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onFocus={this.onFocus}
          registry={registry}
          safeRenderCompletion={safeRenderCompletion}
        />
        {children ? (
          children
        ) : (
          <p>
            <button type="submit" className="btn btn-info">
              Submit
            </button>
          </p>
        )}
      </form>
    );
  }
}

if (process.env.NODE_ENV !== "production") {
  Form.propTypes = {
    schema: PropTypes.object.isRequired,
    uiSchema: PropTypes.object,
    formData: PropTypes.any,
    widgets: PropTypes.objectOf(
      PropTypes.oneOfType([PropTypes.func, PropTypes.object])
    ),
    fields: PropTypes.objectOf(PropTypes.func),
    ArrayFieldTemplate: PropTypes.func,
    ObjectFieldTemplate: PropTypes.func,
    FieldTemplate: PropTypes.func,
    ErrorList: PropTypes.func,
    onChange: PropTypes.func,
    onError: PropTypes.func,
    showErrorList: PropTypes.bool,
    onSubmit: PropTypes.func,
    id: PropTypes.string,
    className: PropTypes.string,
    name: PropTypes.string,
    method: PropTypes.string,
    target: PropTypes.string,
    action: PropTypes.string,
    autocomplete: PropTypes.string,
    enctype: PropTypes.string,
    acceptcharset: PropTypes.string,
    noValidate: PropTypes.bool,
    noHtml5Validate: PropTypes.bool,
    liveValidate: PropTypes.bool,
    validate: PropTypes.func,
    transformErrors: PropTypes.func,
    safeRenderCompletion: PropTypes.bool,
    formContext: PropTypes.object,
  };
}
