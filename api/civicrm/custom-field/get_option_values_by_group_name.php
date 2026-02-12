<?php
  require '../../../../wp-content/plugins/civicrm/civicrm/civicrm.config.php';

  $group_name = $_GET['name'];

  $optionValues = \Civi\Api4\OptionValue::get(false)
    -> addSelect('name', 'label', 'value')
    -> addWhere('option_group_id:name', '=', $group_name)
    -> execute();

  echo json_encode($optionValues)
?>