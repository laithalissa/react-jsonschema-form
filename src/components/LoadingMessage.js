import React from "react";

export default function LoadingMessage(props) {
  if (!props.show) {
    return null;
  }
  if (props.renderFunction) {
    return props.renderFunction();
  }
  return (
    <div className="alert alert-info" role="alert">
      {props.message}
    </div>
  );
}
