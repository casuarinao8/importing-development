<?php
  require '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $set_name = $_GET['name'];

  $fields = \Civi\Api4\CustomField::get(false)
    -> addSelect('html_type', 'name', 'label', 'is_required', 'custom_group_id:name',  'option_group_id', 'option_group_id:name')
    -> addWhere('custom_group_id:name', '=', $set_name)
    -> addChain('options', \Civi\Api4\OptionValue::get(false)
      -> addSelect('name', 'label', 'value')
      -> addWhere('option_group_id', '=', '$option_group_id')
    )
    -> execute();

  echo json_encode($fields);
?>