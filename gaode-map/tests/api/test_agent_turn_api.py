import pytest


@pytest.mark.skip(reason="路由级测试依赖外部应用装配，当前环境使用 runtime/provider 测试覆盖主流程。")
def test_agent_turn_api_placeholder():
    assert True
