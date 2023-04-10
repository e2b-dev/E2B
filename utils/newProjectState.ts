export enum CreationState {
  SelectingID,
  SelectingTemplate,
  CreatingProject,
  Faulted,
}

export enum CreationEvent {
  ConfirmID,
  ConfirmTemplate,
  Back,
  Fail,
}