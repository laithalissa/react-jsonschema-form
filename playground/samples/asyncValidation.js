function asyncValidate({ pass1, pass2 }, errors) {
  return new Promise(resolve => {
    setTimeout(() => {
      if (pass1 !== pass2) {
        errors.pass2.addError("Passwords don't match.");
      }
      resolve(errors);
    }, 1000);
  });
}

module.exports = {
  schema: {
    title: "Async validation",
    description:
      "This form defines custom async validation rules checking that the two passwords match.",
    type: "object",
    properties: {
      pass1: {
        title: "Password",
        type: "string",
      },
      pass2: {
        title: "Repeat password",
        type: "string",
      },
    },
  },
  uiSchema: {
    pass1: { "ui:widget": "password" },
    pass2: { "ui:widget": "password" },
  },
  formData: {},
  validate: asyncValidate,
};
